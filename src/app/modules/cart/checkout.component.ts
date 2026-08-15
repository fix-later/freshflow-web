import { DecimalPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiCode, describeApiError } from 'app/core/api/error-codes';
import { SignInRequiredComponent } from 'app/core/auth/components/sign-in-required.component';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { DraftOrderLine } from 'app/layout/common/draft-order/draft-order.types';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { OrdersService } from 'app/modules/orders/orders.service';
import {
    MarketSessionWindow,
    OrderConfirmPreview,
    OrderRow,
} from 'app/modules/orders/orders.types';
import { DeliveryAddressesComponent } from 'app/modules/restaurant/delivery-addresses/delivery-addresses.component';
import { RestaurantProfileService } from 'app/modules/restaurant/restaurant-profile.service';
import { DateTime } from 'luxon';
import { cartLineIssues, caseCount } from './cart-line-rules';

/** Daily order cutoff (BR-ORD-2): 22:00 — after this, earliest delivery +1 extra day. */
const CUTOFF_HOUR = 22;

/**
 * Every order delivers in the same fixed early-morning window — the restaurant
 * only picks the day (see `deliveryDate`), never the time. Kept as a single
 * constant (rather than a start/end pair) because only the start is ever
 * written to `scheduledFor`; "4-6h sáng" is the human label for this hour.
 */
const DELIVERY_HOUR = 4;

/**
 * How many days of delivery dates the picker offers, counting the earliest
 * selectable day. Prices are quoted per market day and only locked at
 * confirmation (BR-ORD-3), so booking months ahead would promise a slot the
 * procurement side cannot plan or price.
 */
const DELIVERY_WINDOW_DAYS = 7;

function addCalendarDays(base: Date, days: number): Date {
    const next = new Date(base);
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() + days);
    return next;
}

/**
 * Earliest selectable delivery date:
 * - before 22:00 → tomorrow (today + 1)
 * - 22:00–24:00 → day after tomorrow (today + 2)
 */
export function earliestDeliveryDate(now = new Date()): Date {
    const afterCutoff = now.getHours() >= CUTOFF_HOUR;
    return addCalendarDays(now, afterCutoff ? 2 : 1);
}

function toLuxonDay(date: Date): DateTime {
    return DateTime.fromJSDate(date).startOf('day');
}

@Component({
    selector: 'checkout',
    templateUrl: './checkout.component.html',
    styleUrls: ['./cart.component.scss', './checkout.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        SignInRequiredComponent,
        DecimalPipe,
        FormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatDatepickerModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSnackBarModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class CheckoutComponent implements OnInit {
    private readonly _router = inject(Router);
    private readonly _draftOrder = inject(DraftOrderService);
    private readonly _permissions = inject(PermissionsService);

    /** Guests are stopped before the form, not at the confirm button. */
    readonly isSignedIn = this._permissions.isSignedIn;
    private readonly _transloco = inject(TranslocoService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _orders = inject(OrdersService);
    private readonly _restaurantProfile = inject(RestaurantProfileService);
    private readonly _dialog = inject(MatDialog);

    readonly lines = this._draftOrder.lines;
    readonly subtotal = this._draftOrder.subtotal;

    readonly placed = signal(false);
    readonly submitting = signal(false);

    /** The draft this checkout created, and the order it was created for. */
    private _draftId: string | null = null;
    private _draftKey: string | null = null;
    /**
     * Reasons the server refused to confirm, already localized — the preview
     * reports them as `{ code, message }` with an English message, so each one
     * is resolved through the shared code map before it reaches the list.
     */
    readonly blockers = signal<string[]>([]);
    readonly freshQualityNote = signal(true);
    readonly extraNote = signal('');

    /**
     * Earliest day the restaurant may pick. Seeded from the local 22:00 rule
     * so the picker works offline, then corrected by
     * `GET /orders/ordering-window` — the server owns the real cutoff.
     */
    readonly minDeliveryDate = signal(toLuxonDay(earliestDeliveryDate()));

    /**
     * How many days wide the picker is. Seeded with the local default and
     * replaced by the server's `deliveryWindowDays` operational setting, so an
     * admin widening or narrowing the booking horizon takes effect here.
     */
    readonly deliveryWindowDays = signal(DELIVERY_WINDOW_DAYS);

    /**
     * Last day the restaurant may pick. The window counts the earliest day, so
     * a delivery cannot be booked further out than the market can plan for.
     *
     * One day shorter than the server's own `D..D+windowDays` window
     * (`OrderCutoffScheduler.IsWithinDeliveryWindow`): that check's upper bound
     * is an exact midnight cutoff, not end-of-day, so the nominal last day would
     * only ever accept a `scheduledFor` of precisely 00:00 — never
     * `DELIVERY_HOUR` (04:00), which every order now carries. Capping the
     * picker here keeps every day it actually offers usable.
     */
    readonly maxDeliveryDate = computed(() =>
        this.minDeliveryDate()
            .plus({ days: this.deliveryWindowDays() - 2 })
            .startOf('day')
    );

    readonly deliveryDate = signal<DateTime>(this.minDeliveryDate());

    readonly afterCutoff = signal(new Date().getHours() >= CUTOFF_HOUR);

    /**
     * The chợ's session for the chosen delivery day, once read. A chợ closes
     * to its own `closesAt`, not the platform-wide cutoff above, so this is
     * what decides whether the day can still be ordered for.
     *
     * `null` after {@link sessionChecked} turns true means the day has no
     * session at all — the backend generates them, and one that does not exist
     * cannot be ordered into.
     */
    readonly marketSession = signal<MarketSessionWindow | null>(null);
    readonly sessionChecked = signal(false);

    /**
     * Why the chosen day cannot be ordered for, as an i18n key — or `null`
     * while it can, or while the answer is not known yet. Silent until the
     * session has actually been read, so a slow lookup never accuses a day
     * that is fine.
     */
    readonly sessionBlocker = computed<string | null>(() => {
        if (!this.sessionChecked()) {
            return null;
        }
        const session = this.marketSession();
        if (!session) {
            return 'checkout.shipping.sessionMissing';
        }
        return session.status === 'open'
            ? null
            : 'checkout.shipping.sessionClosed';
    });

    /** The chợ's real deadline for the chosen day, when it is still open. */
    readonly sessionClosesAt = computed<DateTime | null>(() => {
        const session = this.marketSession();
        if (!session?.closesAt || session.status !== 'open') {
            return null;
        }
        const closes = DateTime.fromISO(session.closesAt);
        return closes.isValid ? closes : null;
    });

    /** The restaurant's default saved delivery address, once loaded. */
    readonly defaultAddress = computed(
        () =>
            this._restaurantProfile.defaultDeliveryAddress()?.addressLine ??
            null
    );

    /**
     * The address the order ships to. `POST /orders/{id}/confirm` requires it,
     * and it is what the delivery fee is priced from.
     */
    private _addressId(): string | null {
        return this._restaurantProfile.defaultDeliveryAddress()?.id ?? null;
    }

    /**
     * The server's priced breakdown for the current cart, from
     * `confirm-preview`. It is the only place delivery is priced, so the
     * summary shows the real figures instead of guessing at them.
     */
    readonly quote = signal<OrderConfirmPreview | null>(null);
    readonly quoting = signal(false);

    readonly deliveryFee = computed(() => this.quote()?.deliveryFee ?? null);
    readonly vatAmount = computed(() => this.quote()?.vatAmount ?? null);
    readonly deliveryDistanceKm = computed(
        () => this.quote()?.deliveryDistanceKm ?? null
    );

    /**
     * Opens the saved-address manager over checkout.
     *
     * `CreateDraftOrderRequest` carries no address — the backend delivers to
     * the restaurant's default — so this is not a per-order picker: it exists
     * so a buyer who has no address yet, or the wrong one set as default, can
     * fix that without losing the cart they are standing in.
     */
    openAddresses(): void {
        const ref = this._dialog.open(DeliveryAddressesComponent, {
            autoFocus: false,
            width: '44rem',
            maxWidth: '95vw',
            panelClass: 'checkout-address-dialog',
        });
        // The dialog writes through the same service the summary reads, but a
        // dialog dismissed mid-edit may have saved before closing — re-read so
        // the summary can never show a stale default.
        ref.afterClosed().subscribe(() => {
            void this._restaurantProfile
                .loadDeliveryAddresses()
                .catch(() => {
                    // Keep whatever the summary already had.
                })
                // A different address is a different distance, so the fee has
                // to be re-priced.
                .then(() => this.refreshQuote());
        });
    }

    /**
     * What the restaurant will actually owe: the server's own figure once the
     * quote lands, the goods total until then.
     *
     * The summary used to add an 8% VAT and offer a 10% coupon that the backend
     * never charged, so the payable both overstated the debt *and* left out the
     * delivery fee the server does charge. Every number here now comes from
     * `confirm-preview`.
     */
    readonly total = computed(
        () => this.quote()?.totalAmount ?? this.subtotal()
    );

    readonly isVi = computed(() => this._transloco.getActiveLang() === 'vi');

    ngOnInit(): void {
        if (!this.lines().length && !this.placed()) {
            void this._router.navigateByUrl('/cart');
        }
        this._applyOrderingWindow();
        this._loadMarketSession();
        void this._restaurantProfile
            .loadDeliveryAddresses()
            .catch(() => {
                // The summary just shows no address; not fatal to checkout.
            })
            .then(() => this.refreshQuote());
    }

    /**
     * Prices the current order with the server.
     *
     * Delivery is charged by distance to the address, so `confirm-preview` is
     * the only place the fee exists — and it prices an *order*, which is why
     * this needs the draft. The draft is the one the confirm will use, so no
     * extra order is created for the quote.
     *
     * Best-effort: a failed quote leaves the summary on the goods total rather
     * than blocking checkout, and the server still prices the confirm itself.
     */
    async refreshQuote(): Promise<void> {
        const addressId = this._addressId();
        const items = this._items();
        if (!items.length || !addressId || this.quoting()) {
            return;
        }
        this.quoting.set(true);
        try {
            const orderId = await this._draftFor(
                items,
                this._scheduledFor(),
                this.extraNote().trim() || undefined
            );
            this.quote.set(
                await this._orders.getConfirmPreview(orderId, addressId)
            );
        } catch {
            this.quote.set(null);
        } finally {
            this.quoting.set(false);
        }
    }

    private _items(): { marketProductId: string; quantity: number }[] {
        return this.lines().map((line) => ({
            marketProductId: line.product.marketProductId,
            quantity: line.quantity,
        }));
    }

    /**
     * "Đặt định kỳ với các sản phẩm này" — hands the current cart lines to the
     * recurring-order page's create form instead of placing a one-off order.
     * Router `state` (not query params) since this is a one-shot handoff, same
     * pattern already used for admin detail pages (`history.state?.order` etc.).
     * The cart itself is untouched — same non-destructive convention as reorder.
     */
    goToRecurring(): void {
        void this._router.navigate(['/profile/scheduled'], {
            state: { prefillItems: this._items() },
        });
    }

    /**
     * Replaces the locally derived cutoff with the server's, so a backend that
     * moves the cutoff (or blocks ordering entirely) is reflected here. A
     * failed call leaves the local BR-ORD-2 fallback in place.
     */
    private _applyOrderingWindow(): void {
        void this._orders
            .getOrderingWindow()
            .then((window) => {
                this.afterCutoff.set(!window.isOpen);
                // 1–30 per `UpdateOperationalSettingsRequest`; anything outside
                // that is not a horizon the picker should honour.
                const days = window.deliveryWindowDays;
                if (days != null && days >= 1 && days <= 30) {
                    this.deliveryWindowDays.set(days);
                }
                const earliest = window.earliestServiceDate
                    ? DateTime.fromISO(window.earliestServiceDate).startOf(
                          'day'
                      )
                    : null;
                if (!earliest?.isValid) {
                    return;
                }
                this.minDeliveryDate.set(earliest);
                // A later cutoff moves the whole window, so a date picked
                // before the correction can fall outside it at either end.
                if (this.deliveryDate() < earliest) {
                    this.deliveryDate.set(earliest);
                } else if (this.deliveryDate() > this.maxDeliveryDate()) {
                    this.deliveryDate.set(this.maxDeliveryDate());
                }
            })
            .catch(() => {
                // Keep the local cutoff rule; the server still enforces its own.
            });
    }

    /**
     * Lines the server would refuse, each phrased with its product name and the
     * figure that was breached. Stock is only checked when the listing reported
     * one — `quantity` is null for a listing that does not track it, and a
     * missing figure is not a limit of zero.
     */
    private _lineIssues(): string[] {
        return this.lines().flatMap((line) =>
            cartLineIssues(line, this.productName(line.product)).map((issue) =>
                this._transloco.translate(issue.key, issue.params)
            )
        );
    }

    productName(product: CatalogProduct): string {
        return this.isVi() ? product.name : product.nameEn;
    }

    /**
     * The short unit, for sitting beside a quantity or a price.
     *
     * Falls back to kilograms: a line restored from the server is rebuilt from
     * the order item, which carries no unit at all
     * (`DraftOrderService._degradedProduct`). Kilograms is not a guess — cart
     * quantity *is* kg, and the stepper moves by a whole case of them.
     */
    unitShort(product: CatalogProduct): string {
        const unit = this.isVi() ? product.unit : product.unitEn;
        return product.unitShort || unit || 'kg';
    }

    /** Cases, matching the cart. The confirm still sends kilograms. */
    readonly caseCount = caseCount;

    /** "kiện" when there is a case to count in, else the product's own unit. */
    caseUnit(line: DraftOrderLine): string {
        const weight = line.product.packWeightKg;
        return weight !== null && weight !== undefined && weight > 0
            ? this._transloco.translate('cart.caseUnit')
            : this.unitShort(line.product);
    }

    lineTotal(line: DraftOrderLine): number {
        return line.unitPrice * line.quantity;
    }

    onDeliveryDateChange(value: DateTime | null): void {
        if (!value || !value.isValid || value < this.minDeliveryDate()) {
            this.deliveryDate.set(this.minDeliveryDate());
            return;
        }
        // The picker's own `max` blocks this, but a typed or restored value
        // can still land past the window.
        if (value > this.maxDeliveryDate()) {
            this.deliveryDate.set(this.maxDeliveryDate());
            return;
        }
        this.deliveryDate.set(value.startOf('day'));
        this._loadMarketSession();
        void this.refreshQuote();
    }

    /**
     * Reads the chợ's session for the chosen day.
     *
     * The market comes from the cart itself — every line is a listing of one
     * chợ — rather than the header's selection, which the restaurant can change
     * after filling the cart.
     */
    private _loadMarketSession(): void {
        const marketId = this.lines()[0]?.product.marketId;
        const serviceDate = this.deliveryDate().toFormat('yyyy-MM-dd');
        if (!marketId) {
            this.sessionChecked.set(false);
            return;
        }
        void this._orders
            .getMarketSession(marketId, serviceDate)
            .then((session) => {
                // A date change in flight wins; this answer is for a day the
                // restaurant has already moved off.
                if (
                    this.deliveryDate().toFormat('yyyy-MM-dd') !== serviceDate
                ) {
                    return;
                }
                this.marketSession.set(session);
                this.sessionChecked.set(true);
            })
            .catch(() => {
                // Unknown, not closed: the confirm call still enforces it.
                this.marketSession.set(null);
                this.sessionChecked.set(false);
            });
    }

    placeOrder(): void {
        if (!this.lines().length || this.submitting()) {
            return;
        }
        // The button is disabled for this, but a restored form or a session
        // that closed while the page sat open can still reach here.
        const blocker = this.sessionBlocker();
        if (blocker) {
            this._snackBar.open(this._transloco.translate(blocker), undefined, {
                duration: 4000,
            });
            return;
        }
        if (this.deliveryDate() < this.minDeliveryDate()) {
            this.deliveryDate.set(this.minDeliveryDate());
            this._snackBar.open(
                this._transloco.translate('checkout.shipping.dateInvalid'),
                undefined,
                { duration: 3000 }
            );
            return;
        }
        // Per-line rules the server applies while pricing the confirm
        // (`MINIMUM_ORDER_QUANTITY_NOT_MET`, `INSUFFICIENT_STOCK`). Both are
        // decidable from what is already on screen, and both would otherwise
        // cost a draft creation and a round-trip to learn — named per product,
        // since "one of your lines" is not something a buyer can act on.
        const lineIssues = this._lineIssues();
        if (lineIssues.length) {
            this.blockers.set(lineIssues);
            return;
        }
        // The confirm ships to this address and the fee is priced from it, so
        // without one there is nothing to place.
        if (!this._addressId()) {
            this.blockers.set([
                this._transloco.translate('checkout.noAddress'),
            ]);
            return;
        }

        const items = this._items();
        const scheduledFor = this._scheduledFor();
        const notes = this.extraNote().trim() || undefined;

        this.submitting.set(true);
        this.blockers.set([]);
        void this._placeOrder(items, scheduledFor, notes).finally(() =>
            this.submitting.set(false)
        );
    }

    /**
     * Draft → preview → confirm. The preview asks the server whether the
     * approval / cutoff / credit gates pass *before* committing, so a refusal
     * arrives as a specific reason instead of a generic failure on confirm.
     * A blocked attempt leaves the draft in place — the restaurant can fix the
     * cause and retry without rebuilding the cart.
     */
    private async _placeOrder(
        items: { marketProductId: string; quantity: number }[],
        scheduledFor: Date,
        notes: string | undefined
    ): Promise<void> {
        const addressId = this._addressId();
        if (!addressId) {
            return;
        }
        try {
            const orderId = await this._draftFor(items, scheduledFor, notes);

            const preview = await this._orders
                .getConfirmPreview(orderId, addressId)
                // A preview that fails to load must not block a legal order —
                // the server still gates the confirm itself.
                .catch(() => null);
            if (preview) {
                this.quote.set(preview);
            }
            if (preview && !preview.canConfirm) {
                const translate = (key: string): string =>
                    this._transloco.translate(key);
                this.blockers.set(
                    preview.blockers.length
                        ? preview.blockers.map((issue) =>
                              describeApiCode(
                                  issue.code,
                                  issue.message,
                                  translate,
                                  'checkout.blockedGeneric'
                              )
                          )
                        : [translate('checkout.blockedGeneric')]
                );
                return;
            }
            this._noteResolvedSchedule(preview?.resolvedScheduledFor ?? null);

            await this._orders.confirmOrder(orderId, addressId);
            this._draftId = null;
            this._draftKey = null;
            this.quote.set(null);
            this.placed.set(true);
            this._draftOrder.clear();
            this._snackBar.open(
                this._transloco.translate('cart.orderPlaced'),
                undefined,
                { duration: 3000 }
            );
        } catch (err) {
            // Keep the cart intact so the restaurant can retry. Every rejection
            // the API can answer with — 400 bad payload, 403 not yours, 422
            // approval / credit / stock — resolves to its own message, shown
            // both inline (blockers) and as a toast.
            const message = await describeApiError(
                err,
                (key) => this._transloco.translate(key),
                'checkout.placeOrderError'
            );
            this.blockers.set([message]);
            this._snackBar.open(message, undefined, { duration: 6000 });
        }
    }

    /**
     * Tells the buyer when the server settled on a different delivery slot than
     * the one they picked — the cutoff can roll an order to the next cycle
     * (BR-ORD-2), and finding that out from the order list afterwards is worse
     * than a line on the confirmation.
     */
    private _noteResolvedSchedule(resolved: string | null): void {
        if (!resolved) {
            return;
        }
        const settled = DateTime.fromISO(resolved);
        if (!settled.isValid || settled.hasSame(this.deliveryDate(), 'day')) {
            return;
        }
        this._snackBar.open(
            this._transloco.translate('checkout.shipping.dateMoved', {
                date: settled.toFormat('dd/MM/yyyy'),
            }),
            undefined,
            { duration: 6000 }
        );
    }

    /**
     * The server-side draft to confirm, reusing the one this checkout already
     * created when nothing about the order has changed.
     *
     * `POST /orders` creates a real order in `draft` status (BR-ORD-4), and a
     * blocked or failed attempt leaves it there. Creating a fresh one per retry
     * therefore littered the restaurant's order list with a draft per attempt.
     * A retry now confirms the same draft; only an edited cart, date, slot or
     * note starts a new one, and the superseded draft is cancelled so it does
     * not linger either.
     */
    private async _draftFor(
        items: { marketProductId: string; quantity: number }[],
        scheduledFor: Date,
        notes: string | undefined
    ): Promise<string> {
        const key = JSON.stringify([items, scheduledFor.toISOString(), notes]);
        if (this._draftId && this._draftKey === key) {
            return this._draftId;
        }

        // The cart is itself a draft order now, so the first attempt reuses it
        // rather than opening a second one beside it. Only its delivery date
        // and notes can disqualify it: the items are the cart's, and a draft's
        // `scheduledFor` cannot be changed after creation.
        const cartDraftId = this._draftOrder.orderId();
        if (!this._draftId && cartDraftId) {
            const draft = await this._orders
                .getOrder(cartDraftId)
                .catch(() => null);
            if (draft && this._draftMatches(draft, scheduledFor, notes)) {
                this._draftId = cartDraftId;
                this._draftKey = key;
                return cartDraftId;
            }
        }

        const stale = this._draftId ?? cartDraftId;
        this._draftId = null;
        if (stale) {
            // Best-effort: a draft we can't cancel is not worth failing on.
            void this._orders
                .cancelOrder(
                    stale,
                    this._transloco.translate('checkout.draftSuperseded')
                )
                .catch(() => undefined);
        }
        const orderId = await this._orders.createOrder(
            items,
            scheduledFor,
            notes
        );
        this._draftId = orderId;
        this._draftKey = key;
        // The cart follows the draft it is backed by, so a reload after this
        // point restores the order that is actually open.
        this._draftOrder.adopt(orderId);
        return orderId;
    }

    /** True when this draft already carries the chosen slot and note. */
    private _draftMatches(
        draft: OrderRow,
        scheduledFor: Date,
        notes: string | undefined
    ): boolean {
        const draftSchedule = draft['scheduledFor'];
        const scheduleMatches =
            typeof draftSchedule === 'string' &&
            new Date(draftSchedule).getTime() === scheduledFor.getTime();
        const draftNotes = (draft['notes'] as string | null) ?? '';
        return scheduleMatches && draftNotes === (notes ?? '');
    }

    /** Combines the selected delivery day with the fixed early-morning delivery hour. */
    private _scheduledFor(): Date {
        return this.deliveryDate()
            .set({ hour: DELIVERY_HOUR, minute: 0, second: 0, millisecond: 0 })
            .toJSDate();
    }

    trackByLine(_: number, line: DraftOrderLine): string {
        return line.product.id;
    }
}
