import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { UserService } from 'app/core/user/user.service';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { OrdersService } from 'app/modules/orders/orders.service';
import { OrderRow } from 'app/modules/orders/orders.types';
import { DateTime } from 'luxon';
import { clampToStock } from './draft-order.rules';
import { DraftOrderLine, DraftSyncState } from './draft-order.types';

/**
 * Business dates are GMT+7 across FreshFlow (BR-002), so "the day this session
 * trades on" is a Hanoi calendar day, not the browser's.
 */
const SESSION_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * The restaurant's in-progress order — and, for a signed-in restaurant, the
 * **`Draft` order on the server**, not a local cart.
 *
 * `OrderStatus.Draft` exists precisely so a part-built order survives leaving
 * the page: `POST /orders` opens one, the item routes edit it, and
 * `POST /orders/{id}/confirm` is what turns it into a real order. Holding the
 * cart only in memory meant a reload lost it, and every order was created and
 * confirmed in the same breath at checkout — so the draft state the backend
 * models was never actually occupied.
 *
 * Writes are **optimistic**: the local lines update immediately and the matching
 * request is queued behind the previous one, because the UI is a stepper the
 * user can click faster than a round-trip. A failed write re-reads the draft —
 * the server is the authority — and reports why through {@link syncError}.
 *
 * Signed out, none of that applies: there is no restaurant to own a draft, so
 * the cart stays local (`'local'`) and is pushed up on the next sign-in.
 */
@Injectable({ providedIn: 'root' })
export class DraftOrderService {
    private readonly _orders = inject(OrdersService);
    private readonly _userService = inject(UserService);
    private readonly _transloco = inject(TranslocoService);
    private readonly _snackBar = inject(MatSnackBar);
    /**
     * Which chợ the buyer is shopping — the session whose window decides
     * whether a draft still belongs to the cart is that chợ's, not a
     * platform-wide one. Optional so a harness that never selects a market
     * still resolves the service (see `_currentSessionWindow`).
     */
    private readonly _markets = inject(MarketSelectionService, {
        optional: true,
    });

    private readonly _lines = signal<DraftOrderLine[]>([]);

    readonly lines = this._lines.asReadonly();
    /**
     * Distinct products in the cart — what the header badge and drawer title
     * count. `quantity` is kg, not units (and jumps by a whole case per step
     * since packing sizes landed), so summing it no longer means "how many
     * products": a handful of 5kg-cased lines could already read as 30+.
     */
    readonly productCount = computed(() => this._lines().length);
    readonly totalQuantity = computed(() =>
        this._lines().reduce((sum, line) => sum + line.quantity, 0)
    );
    /** Display subtotal only — final price locks at confirmation (PRD §5). */
    readonly subtotal = computed(() =>
        this._lines().reduce(
            (sum, line) => sum + line.unitPrice * line.quantity,
            0
        )
    );

    /** The server draft backing this cart, once one exists. */
    private readonly _orderId = signal<string | null>(null);
    readonly orderId = this._orderId.asReadonly();

    private readonly _syncState = signal<DraftSyncState>('local');
    readonly syncState = this._syncState.asReadonly();

    /** Localized reason the last write failed, cleared by the next success. */
    private readonly _syncError = signal<string | null>(null);
    readonly syncError = this._syncError.asReadonly();

    /**
     * Serializes writes. Two `+` clicks on one line must not race into two
     * `PUT`s whose order the server decides — the second would win by arrival,
     * not by intent.
     */
    private _queue: Promise<void> = Promise.resolve();

    /**
     * `marketProductId` → `orderItemId` as of the last read of the draft. The
     * item routes are keyed by the order-item id, and a queued write can outlive
     * the local line it belongs to, so the mapping is kept beside the lines
     * rather than inside them.
     */
    private _serverItemIds = new Map<string, string>();

    /**
     * Open-state of the header draft-order drawer. Kept here (not in the
     * component) so the header trigger and the drawer panel — which render in
     * different parts of the layout, decoupled so the header's pin animation
     * can't affect the drawer — share one source of truth.
     */
    private readonly _drawerOpen = signal(false);
    readonly drawerOpen = this._drawerOpen.asReadonly();

    /** Whose draft the cart currently holds, so a re-emit is not a re-read. */
    private _adoptedUserId: string | null = null;

    constructor() {
        // The draft belongs to a restaurant, so the cart follows the session:
        // adopted on sign-in (including a reload, where the profile arrives
        // asynchronously) and dropped on sign-out, where it is no longer this
        // browser's to show.
        this._userService.user$.pipe(takeUntilDestroyed()).subscribe((user) => {
            const id = user?.role === 'restaurant' ? user.id : null;
            if (id === this._adoptedUserId) {
                return;
            }
            this._adoptedUserId = id;
            if (!id) {
                this._lines.set([]);
                this._orderId.set(null);
                this._syncState.set('local');
                return;
            }
            void this.restore();
        });
    }

    toggleDrawer(): void {
        this._drawerOpen.update((open) => !open);
    }

    setDrawerOpen(open: boolean): void {
        this._drawerOpen.set(open);
    }

    closeDrawer(): void {
        this._drawerOpen.set(false);
    }

    /**
     * Adopts the server draft as the cart: loads the open one, or opens a new
     * one from whatever was added while signed out.
     *
     * Called on start-up and after a sign-in. Safe to call again — a second run
     * re-reads rather than duplicating, because the lines it writes come from
     * the server's own item ids.
     */
    async restore(): Promise<void> {
        if (!this._isRestaurant()) {
            this._syncState.set('local');
            return;
        }
        this._syncState.set('loading');
        try {
            const draft = await this._findDraft();
            const pending = this._lines().filter((line) => !line.orderItemId);

            if (!draft) {
                // Nothing open on the server. Only worth creating one if there
                // is something to put in it.
                if (pending.length) {
                    await this._createDraftFrom(pending);
                }
                this._syncState.set(pending.length ? 'saved' : 'local');
                this._syncError.set(null);
                return;
            }

            this._orderId.set(draft.id);
            // The list answers `OrderListItemDto`, which carries `itemCount`
            // and **no `items`** — reading the lines off it restored an empty
            // cart every time. The lines only exist on `GET /orders/{id}`.
            await this._reload();
            // Lines added while signed out are merged into the draft that was
            // already open, rather than discarded in favour of it.
            for (const line of pending) {
                await this._orders.addItem(
                    draft.id,
                    line.product.marketProductId,
                    line.quantity
                );
            }
            if (pending.length) {
                await this._reload();
            }
            this._syncState.set('saved');
            this._syncError.set(null);
        } catch (err) {
            await this._reportSyncFailure(err);
        }
    }

    /**
     * Adds a product line (or bumps quantity). Unit price defaults to the
     * catalog listing price so callers don't have to pass it every time.
     *
     * `quantity` defaults to one whole case (`packWeightKg`) rather than 1 —
     * a market product is only ever picked/shipped by the case, so "add to
     * cart" from the catalog tile starts a line at a legal quantity instead
     * of one every listing would immediately flag as below the case size.
     * Every caller that omits the argument relies on this; none currently
     * pass their own. Falls back to 1 for a product with no packing code,
     * matching `cart-line-rules.ts`'s `packSize()` — unreachable in practice
     * since `product-card.component.ts`'s `canAddToCart()` already refuses
     * to add such a product.
     */
    add(
        product: CatalogProduct,
        quantity = product.packWeightKg && product.packWeightKg > 0
            ? product.packWeightKg
            : 1,
        unitPrice?: number
    ): void {
        const price = unitPrice ?? product.price ?? 0;
        const existing = this._find(product.marketProductId, product.id);
        const held = existing?.quantity ?? 0;

        // What the listing can still supply on top of what this cart already
        // holds. Enforced here rather than at each tile: the cart row's stepper
        // used to be the only thing checking it, so ten presses of "add" on a
        // catalog tile walked straight past the stock the server would refuse.
        const wanted = clampToStock(product, held + quantity) - held;
        if (wanted <= 0) {
            this._refuseOverStock(product, held);
            return;
        }
        quantity = wanted;

        if (existing) {
            this.setQuantity(product.id, held + quantity);
            return;
        }

        this._lines.update((lines) => [
            ...lines,
            { product, quantity, unitPrice: price },
        ]);
        this._enqueue(async (orderId) => {
            if (!orderId) {
                await this._createDraftFrom(this._lines());
                return;
            }
            await this._orders.addItem(
                orderId,
                product.marketProductId,
                quantity
            );
            await this._reload();
        });
    }

    setQuantity(productId: string, quantity: number): void {
        if (quantity <= 0) {
            this.remove(productId);
            return;
        }
        const line = this._find(productId, productId);
        if (!line) {
            return;
        }
        const allowed = clampToStock(line.product, quantity);
        if (allowed < quantity) {
            this._refuseOverStock(line.product, allowed);
            if (allowed <= 0 || allowed === line.quantity) {
                return;
            }
            quantity = allowed;
        }
        this._lines.update((lines) =>
            lines.map((entry) =>
                entry === line
                    ? {
                          ...entry,
                          quantity,
                          // Heal lines stored with the old 0-price default.
                          unitPrice:
                              entry.unitPrice || entry.product.price || 0,
                      }
                    : entry
            )
        );
        this._enqueue(async (orderId) => {
            const itemId = this._itemIdFor(line);
            if (!orderId || !itemId) {
                // No server line to update — the add that created it has not
                // landed yet, so a re-read is what reconciles the two.
                await this._reload();
                return;
            }
            await this._orders.updateItemQuantity(orderId, itemId, quantity);
        });
    }

    remove(productId: string): void {
        const line = this._find(productId, productId);
        this._lines.update((lines) => lines.filter((entry) => entry !== line));
        if (!line) {
            return;
        }
        this._enqueue(async (orderId) => {
            const itemId = this._itemIdFor(line);
            if (!orderId || !itemId) {
                return;
            }
            // The last line cannot simply be deleted: an empty draft is a draft
            // the buyer has abandoned, and leaving it open would have the next
            // page load restore an empty cart. Cancel it instead.
            if (!this._lines().length) {
                await this._orders.cancelOrder(orderId);
                this._orderId.set(null);
                this._syncState.set('local');
                return;
            }
            await this._orders.removeItem(orderId, itemId);
        });
    }

    /**
     * Points the cart at a different draft and reads it back.
     *
     * Checkout needs this: a draft's `scheduledFor` is fixed at creation (there
     * is no reschedule route), so choosing another delivery date means a new
     * draft. Handing it back here keeps the invariant that the cart is always
     * *the* open draft — otherwise the replaced one would be orphaned and the
     * next page load would restore it instead.
     */
    adopt(orderId: string): void {
        this._orderId.set(orderId);
        this._enqueue(async () => {
            await this._reload();
        });
    }

    /**
     * Resolves once every queued write has landed on the server.
     *
     * Checkout confirms the draft the cart is backed by rather than sending the
     * basket again, so it has to know the item writes are in before it prices
     * and commits — a `+` clicked a moment before "Place order" is still in
     * flight. Rejections are already reported by `_enqueue`, so this only
     * waits; it never becomes the failure path for a sync error.
     */
    settled(): Promise<void> {
        return this._queue;
    }

    /**
     * Empties the cart locally. Used after a confirm, when the draft has become
     * a real order — so it deliberately does *not* cancel anything server-side.
     */
    clear(): void {
        this._lines.set([]);
        this._orderId.set(null);
        this._syncError.set(null);
        this._syncState.set(this._isRestaurant() ? 'saved' : 'local');
    }

    /** Discards the whole draft, cancelling it on the server if it exists. */
    async discard(): Promise<void> {
        const orderId = this._orderId();
        this._lines.set([]);
        this._orderId.set(null);
        if (!orderId) {
            this._syncState.set('local');
            return;
        }
        try {
            await this._orders.cancelOrder(orderId);
            this._syncState.set('local');
            this._syncError.set(null);
        } catch (err) {
            await this._reportSyncFailure(err);
        }
    }

    /**
     * Says why the cart did not take what was asked for.
     *
     * A badge that simply does not move is indistinguishable from a dropped
     * click, and the surfaces that add to the cart — tiles, the product page,
     * Hot Deals — have no error area of their own, so this is said where the
     * buyer is looking.
     */
    private _refuseOverStock(product: CatalogProduct, available: number): void {
        this._snackBar.open(
            this._transloco.translate('cart.overStock', {
                product: product.name,
                available,
                unit: product.unitShort || product.unit,
            }),
            undefined,
            { duration: 4000 }
        );
    }

    // ── internals ────────────────────────────────────────────────────────

    private _isRestaurant(): boolean {
        return this._userService.current?.role === 'restaurant';
    }

    /** Matches on the id the API keys on first, then the catalog's own. */
    private _find(
        marketProductId: string,
        productId: string
    ): DraftOrderLine | undefined {
        return this._lines().find(
            (line) =>
                line.product.marketProductId === marketProductId ||
                line.product.id === productId
        );
    }

    /**
     * The line's server id.
     *
     * Read from the last server snapshot rather than from the current lines:
     * a write is queued *after* the optimistic local update, so by the time it
     * runs the line may already be gone locally (a removal) while still very
     * much present on the server — which is exactly the line whose id the
     * request needs.
     */
    private _itemIdFor(line: DraftOrderLine): string | undefined {
        return (
            line.orderItemId ??
            this._serverItemIds.get(line.product.marketProductId)
        );
    }

    /**
     * Runs `op` after every write already queued. Signed out, nothing is sent:
     * the local cart is the whole state until `restore()` adopts it.
     */
    private _enqueue(op: (orderId: string | null) => Promise<void>): void {
        if (!this._isRestaurant()) {
            this._syncState.set('local');
            return;
        }
        this._syncState.set('saving');
        this._queue = this._queue
            .then(() => op(this._orderId()))
            .then(() => {
                this._syncState.set('saved');
                this._syncError.set(null);
            })
            .catch((err) => this._reportSyncFailure(err));
    }

    private async _createDraftFrom(lines: DraftOrderLine[]): Promise<void> {
        if (!lines.length) {
            return;
        }
        const orderId = await this._orders.createOrder(
            lines.map((line) => ({
                marketProductId: line.product.marketProductId,
                quantity: line.quantity,
            }))
        );
        this._orderId.set(orderId);
        await this._reload();
    }

    /**
     * The draft to come back to: the newest one **opened on the trading day of
     * the chợ session that is currently open**.
     *
     * The backend lets several drafts exist, and taking the newest of them
     * unconditionally meant a basket abandoned days ago came back as today's
     * cart — with prices that have since moved and a chợ session that has
     * already been batched. Two things must hold for a draft to still be the
     * cart: the session is open, and the draft was opened on that session's
     * day.
     *
     * Otherwise nothing is adopted and the buyer starts clean; the stale
     * drafts stay on the server for their own history. Only when the session
     * cannot be read at all does this fall back to the previous newest-wins
     * behaviour: losing a cart the buyer just built is worse than restoring one
     * that confirm would reject anyway.
     */
    private async _findDraft(): Promise<OrderRow | null> {
        const { orders } = await this._orders.listOrders({
            status: 'draft',
            // Wide enough that a run of stale drafts cannot push the in-window
            // one off the page — the filter below, not the page size, is what
            // narrows this now.
            pageSize: 20,
        });
        if (!orders.length) {
            return null;
        }
        // Newest first — the one the buyer was last building comes first.
        const newestFirst = [...orders].sort((a, b) =>
            String(b['createdAt'] ?? '').localeCompare(
                String(a['createdAt'] ?? '')
            )
        );

        const session = await this._currentSession();
        if (!session) {
            return newestFirst[0];
        }
        if (!session.open) {
            // The chợ is not taking orders, so there is no cart to be building.
            return null;
        }
        return (
            newestFirst.find((order) =>
                this._isOnDay(order['createdAt'], session.day)
            ) ?? null
        );
    }

    /**
     * Whether an order was opened on `day`, compared in Vietnam time.
     *
     * Business dates are GMT+7 across the system (BR-002) while `createdAt`
     * arrives as a UTC instant, so a draft opened at 08:00 Hanoi on the 5th is
     * `2026-08-05T01:00:00Z` — the same calendar day only once converted.
     */
    private _isOnDay(createdAt: unknown, day: string): boolean {
        if (typeof createdAt !== 'string' || !createdAt) {
            // A draft the list did not date cannot be placed in a session.
            // Treat it as out rather than guess it in.
            return false;
        }
        const created = DateTime.fromISO(createdAt).setZone(SESSION_ZONE);
        return created.isValid && created.toFormat('yyyy-MM-dd') === day;
    }

    /**
     * The chợ session that is currently taking orders: the day it trades on,
     * and whether it is still open.
     *
     * Which session is "current" comes from `earliestServiceDate` — the next
     * deliverable day is the one being ordered into. Its trading day is the
     * calendar day of `closesAt`, because a session for service date `D` stops
     * accepting orders at the cutoff on `D-1`
     * (`ProcurementBatchCycle.GetCloseAtUtc`). The deadline is read from the
     * session rather than the browser clock, so a skewed device cannot decide
     * which day a draft belongs to.
     *
     * Three distinct answers:
     *  - `{ open: true, day }` — filter drafts to that day.
     *  - `{ open: false }` — the chợ is closed; adopt nothing.
     *  - `null` — *unknown* (no chợ chosen, no session row, lookup failed), so
     *    the caller keeps the previous newest-wins behaviour rather than
     *    emptying a basket the buyer just built.
     */
    private async _currentSession(): Promise<
        { open: true; day: string } | { open: false } | null
    > {
        try {
            const marketId = this._markets?.selectedId() ?? null;
            if (!marketId) {
                return null;
            }
            const serviceDate = (await this._orders.getOrderingWindow())
                .earliestServiceDate;
            if (!serviceDate) {
                return null;
            }

            const session = await this._orders.getMarketSession(
                marketId,
                serviceDate
            );
            if (!session) {
                return null;
            }
            if (session.status !== 'open') {
                return { open: false };
            }
            if (!session.closesAt) {
                return null;
            }
            const closes = DateTime.fromISO(session.closesAt).setZone(
                SESSION_ZONE
            );
            return closes.isValid
                ? { open: true, day: closes.toFormat('yyyy-MM-dd') }
                : null;
        } catch {
            // Unknown, not empty — see `_findDraft`.
            return null;
        }
    }

    /** Re-reads the draft and replaces the local lines with the server's. */
    private async _reload(): Promise<void> {
        const orderId = this._orderId();
        if (!orderId) {
            return;
        }
        const order = await this._orders.getOrder(orderId);
        if (!order) {
            // Cancelled or confirmed elsewhere — stop pointing at it.
            this._orderId.set(null);
            this._lines.set([]);
            return;
        }
        this._applyServerLines(order);
    }

    /**
     * Rebuilds the cart lines from an order body.
     *
     * `OrderItemDto` carries only what the order needs — id, product name,
     * quantity, unit price, image. The catalog fields the cart also renders
     * (unit, market, category) are not on it, so a restored line keeps whatever
     * the local line already knew and falls back to blanks for a line this
     * session never added. That is the honest degradation: a reloaded cart
     * shows the goods and the money, and fills the rest in when the catalog is
     * visited again.
     */
    private _applyServerLines(order: OrderRow): void {
        const items = Array.isArray(order['items'])
            ? (order['items'] as Record<string, unknown>[])
            : [];
        const known = new Map(
            this._lines().map((line) => [line.product.marketProductId, line])
        );

        this._serverItemIds = new Map(
            items
                .map(
                    (item) =>
                        [
                            String(item['marketProductId'] ?? ''),
                            String(item['orderItemId'] ?? ''),
                        ] as const
                )
                .filter(
                    ([marketProductId, itemId]) => marketProductId && itemId
                )
        );

        this._lines.set(
            items.map((item) => {
                const marketProductId = String(item['marketProductId'] ?? '');
                const previous = known.get(marketProductId);
                const name = String(item['productNameSnapshot'] ?? '');
                const unitPrice = Number(item['unitPrice'] ?? 0);
                return {
                    orderItemId: String(item['orderItemId'] ?? '') || undefined,
                    quantity: Number(item['quantity'] ?? 0),
                    unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
                    product: previous
                        ? previous.product
                        : this._degradedProduct(marketProductId, name, item),
                };
            })
        );
    }

    /** A catalog product stub for a line this session did not add itself. */
    private _degradedProduct(
        marketProductId: string,
        name: string,
        item: Record<string, unknown>
    ): CatalogProduct {
        const thumbnail = String(item['imageUrl'] ?? '');
        const unitPrice = Number(item['unitPrice'] ?? 0);
        const packWeightKg = this._parsePackWeight(item);
        return {
            id: marketProductId,
            productId: marketProductId,
            marketProductId,
            name,
            nameEn: name,
            description: '',
            descriptionEn: '',
            categoryId: '',
            categoryLabel: '',
            unit: '',
            unitEn: '',
            unitShort: '',
            marketId: '',
            marketSource: '',
            price: Number.isFinite(unitPrice) ? unitPrice : null,
            // Stock and the minimum are the listing's, not the order line's.
            // Unknown here, and an unknown limit must not bound the stepper.
            quantity: null,
            totalQuantity: null,
            packWeightKg,
            updatedAt: '',
            minimumOrderQuantity: 1,
            thumbnail,
            images: thumbnail ? [thumbnail] : [],
            active: true,
            // The order line does not report the listing's tags, and nothing on
            // this surface reads them.
            tags: [],
            featured: false,
        };
    }

    /**
     * Kg per case for a line this session did not add itself.
     *
     * `packingWeightKg` is what an order line actually carries
     * (`OrderItemDto.PackingWeightKg`, snapshotted from the packing code's
     * `CapacityKg`); the other two names are tolerated in case a caller passes
     * a listing row instead. Reading only those two meant every real line fell
     * through to the guess below.
     */
    private _parsePackWeight(item: Record<string, unknown>): number | null {
        const directWeight =
            item['packingWeightKg'] ??
            item['packWeightKg'] ??
            item['capacityKg'];
        if (
            typeof directWeight === 'number' &&
            !Number.isNaN(directWeight) &&
            directWeight > 0
        ) {
            return directWeight;
        }
        if (
            typeof directWeight === 'string' &&
            directWeight.trim() !== '' &&
            !Number.isNaN(+directWeight) &&
            +directWeight > 0
        ) {
            return +directWeight;
        }
        // Last resort, for lines placed before the weight was snapshotted: read
        // the leading number out of the code itself ("K20" → 20). It is a
        // guess — a code that numbers rather than measures ("PC-5") reads back
        // a weight it never meant — so it stays behind the real field.
        const packingCode = String(
            item['packingCode'] ?? item['packingCodeSnapshot'] ?? ''
        ).trim();
        if (packingCode) {
            const match = packingCode.match(/(\d+(?:\.\d+)?)/);
            if (match) {
                const parsed = parseFloat(match[1]);
                if (Number.isFinite(parsed) && parsed > 0) {
                    return parsed;
                }
            }
        }
        return null;
    }

    /**
     * Reports a failed write and re-reads the draft, so the cart shows what the
     * server actually holds rather than the optimistic guess that just failed.
     */
    private async _reportSyncFailure(err: unknown): Promise<void> {
        this._syncState.set('error');
        this._syncError.set(
            await describeApiError(
                err,
                (key) => this._transloco.translate(key),
                'cart.syncError'
            )
        );
        try {
            await this._reload();
        } catch {
            // A failed re-read leaves the optimistic lines in place; the error
            // above already tells the buyer not to trust them yet.
        }
    }
}
