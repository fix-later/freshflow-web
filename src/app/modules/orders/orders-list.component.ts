import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    effect,
    inject,
    OnInit,
    signal,
    untracked,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { ApiLabelPipe } from 'app/core/i18n/api-label.pipe';
import { OrderRealtimeService } from 'app/core/realtime/order-realtime.service';
import { openInvoiceSheet } from 'app/modules/restaurant/invoices/invoice-sheet/open-invoice-sheet';
import { RestaurantInvoicesService } from 'app/modules/restaurant/invoices/restaurant-invoices.service';
import { InvoiceRow } from 'app/modules/restaurant/invoices/restaurant-invoices.types';
import {
    RestaurantScheduledOrdersService,
    SCHEDULED_PAGE_SIZE,
} from 'app/modules/restaurant/scheduled-orders/scheduled-orders.service';
import { invoiceStatusPillClass } from 'app/shared/status-pills';
import {
    normalizeOrderStatus,
    ORDER_STATUS_TABS,
    ORDER_TAB_STATUSES,
    OrderRow,
    orderStatusPillClass,
    OrderStatusTab,
    orderStatusTabOf,
} from './orders.types';

/** "Đơn hàng của tôi" — the signed-in restaurant's own order history. */
@Component({
    selector: 'orders-list',
    templateUrl: './orders-list.component.html',
    styleUrl: './orders-list.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        ApiLabelPipe,
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class OrdersListComponent implements OnInit {
    private readonly _historyService = inject(RestaurantScheduledOrdersService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);
    private readonly _realtime = inject(OrderRealtimeService);
    private readonly _destroyRef = inject(DestroyRef);
    private readonly _dialog = inject(MatDialog);
    private readonly _invoices = inject(RestaurantInvoicesService);

    /** Invoices for the orders on this page, keyed by order id. */
    readonly invoicesByOrder = signal<Map<string, InvoiceRow>>(new Map());
    readonly invoiceStatusPillClass = invoiceStatusPillClass;

    readonly statusPillClass = orderStatusPillClass;
    readonly statusKey = (status: string | null | undefined): string =>
        `orders.status.${normalizeOrderStatus(status) || 'unknown'}`;

    readonly rows = signal<OrderRow[]>([]);
    readonly loading = signal(false);
    /** Localized reason the list read failed (400 bad filter, 403, 5xx…). */
    readonly loadError = signal<string | null>(null);
    readonly totalCount = signal(0);
    readonly page = signal(1);

    // ── Status tabs ──────────────────────────────────────────────────────
    //
    // One tab per lifecycle status, plus "all". The filtering is the server's
    // (`GET /orders/history?status=`), not this list's: the page it holds is
    // one page of that status, so paging through "delivered" cannot run out
    // early because the rows it wanted were filtered off the page after the
    // fact — which is what a client-side filter over a paged read does.
    //
    // The list used to read `status: 'delivered'` and show only that. Every
    // other status the restaurant's orders pass through was unreachable here.

    readonly tabs = ORDER_STATUS_TABS;
    readonly activeTab = signal<OrderStatusTab>('all');

    /**
     * Which read the rows on screen belong to. Tabs are a click apart, and the
     * answers come back in whatever order the network settles them — without
     * this, a slow "all" landing after a quick "cancelled" would repaint the
     * cancelled tab with every order.
     */
    private _loadToken = 0;

    /** Timestamp of the last realtime event acted on, so none is handled twice. */
    private _handledAt = 0;

    constructor() {
        // A status broadcast names one order and carries none of the columns
        // this table shows, so the page it belongs to is re-read rather than
        // patched. Only orders already on screen trigger it: an admin session
        // sees every restaurant's traffic on `admin:orders`, and reloading for
        // an order that is not in this list would be a reload for nothing.
        //
        // `rows` is read untracked on purpose. Tracked, the reload this effect
        // performs would rewrite `rows`, re-run the effect, still find the
        // order, and reload again — forever. The only dependency here is the
        // event, and each event is handled once.
        effect(() => {
            const touched = this._realtime.touched();
            if (!touched || touched.at === this._handledAt) {
                return;
            }
            this._handledAt = touched.at;
            const onScreen = untracked(() =>
                this.rows().some(
                    (row) => (row.id ?? row.orderId) === touched.orderId
                )
            );
            if (onScreen) {
                this.load();
            }
        });
    }

    /** The i18n key for a tab's label. */
    tabLabelKey(tab: OrderStatusTab): string {
        return `orders.tabs.${tab}`;
    }

    selectTab(tab: OrderStatusTab): void {
        if (tab === this.activeTab()) {
            return;
        }
        this.activeTab.set(tab);
        // A page number belongs to the list it counted; the new tab starts at
        // its own first page.
        this.page.set(1);
        // `replaceUrl` so flicking across the tabs does not build a back-stack
        // the buyer has to unwind one status at a time to leave the page.
        void this._router.navigate([], {
            relativeTo: this._route,
            queryParams: { status: tab === 'all' ? null : tab },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
        this.load();
    }

    ngOnInit(): void {
        this.activeTab.set(
            orderStatusTabOf(this._route.snapshot.queryParamMap.get('status'))
        );
        this.load();
        void this._realtime.connect();
        // Reconnected: the socket was deaf for a while and the hub replays
        // nothing, so the visible page is re-read wholesale.
        this._realtime.setReconnectHandler(() => this.load());
        this._destroyRef.onDestroy(() => {
            this._realtime.setReconnectHandler(null);
            void this._realtime.disconnect();
        });
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(null);
        const tab = this.activeTab();
        const token = ++this._loadToken;

        this._read(tab)
            .then(({ items, total }) => {
                if (token !== this._loadToken) {
                    return;
                }
                const orders = items as unknown as OrderRow[];
                this.rows.set(orders);
                this.totalCount.set(total ?? orders.length);
                void this._indexInvoices(orders, token);
            })
            .catch(async (err) => {
                if (token !== this._loadToken) {
                    return;
                }
                // An empty table after a failed read would read as "no orders";
                // name the reason instead, and keep the retry available.
                this.rows.set([]);
                this.totalCount.set(0);
                this.loadError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'orders.loadError'
                    )
                );
            })
            .finally(() => {
                if (token === this._loadToken) {
                    this.loading.set(false);
                }
            });
    }

    /**
     * The invoice for each order on this page, when the platform has issued
     * one.
     *
     * A delivered order's VAT invoice is what the restaurant's accountant asks
     * for, and it used to live only in a list of its own where nothing said
     * which order it belonged to. `GET /invoices` takes no order filter, so
     * the page's own orders are matched against the recent invoices: an order
     * with no entry simply shows no invoice, which is also what a not-yet-
     * issued one looks like.
     */
    private async _indexInvoices(
        orders: OrderRow[],
        token: number
    ): Promise<void> {
        const ids = orders
            .map((order) => String(order.id ?? ''))
            .filter(Boolean);
        try {
            const found = await this._invoices.invoicesByOrder(ids);
            if (token === this._loadToken) {
                this.invoicesByOrder.set(found);
            }
        } catch {
            // The orders are the page; a missing invoice chip is not worth an
            // error banner over them.
            if (token === this._loadToken) {
                this.invoicesByOrder.set(new Map());
            }
        }
    }

    /** The invoice issued for `row`, or `null` when there is none to show. */
    invoiceFor(row: OrderRow): InvoiceRow | null {
        return this.invoicesByOrder().get(String(row.id ?? '')) ?? null;
    }

    /** Opens that invoice over the list, the same sheet the invoice list opens. */
    openInvoice(row: OrderRow, event: Event): void {
        event.stopPropagation();
        const invoice = this.invoiceFor(row);
        if (invoice) {
            openInvoiceSheet(this._dialog, invoice.id, invoice);
        }
    }

    /**
     * One page of the active tab.
     *
     * A tab covering a single status (or none, for "all") is one server query
     * with server paging, exactly as before. A **grouped** tab cannot be: the
     * filter takes one status (`OrderQueryParsing.TryParseStatus`), and paging
     * cannot be composed across three separate paged reads — page 2 of
     * "confirmed" and page 2 of "batched" do not make page 2 of the group.
     *
     * So a group is read whole, once per status, and paged here. That is
     * affordable precisely because of what a group *is*: orders still in
     * flight, which are few by nature. The two large tabs — delivered and
     * cancelled — are single statuses and keep server paging.
     */
    private async _read(
        tab: OrderStatusTab
    ): Promise<{ items: OrderRow[]; total: number }> {
        const statuses = ORDER_TAB_STATUSES[tab] ?? [];

        if (statuses.length <= 1) {
            const { items, total } = await this._historyService.listHistory({
                status: statuses[0],
                page: this.page(),
            });
            const rows = items as unknown as OrderRow[];
            if (statuses.length === 1) {
                return { items: rows, total: total ?? rows.length };
            }
            // "all" sends no status, so the server hands back drafts too — the
            // buyer's own carts, one abandoned per market session. They are not
            // orders and must not sit in the order history.
            const placed = rows.filter(
                (row) => normalizeOrderStatus(row.status) !== 'draft'
            );
            const drafts = await this._draftCount();
            return {
                items: placed,
                total: Math.max(0, (total ?? rows.length) - drafts),
            };
        }

        const pages = await Promise.all(
            statuses.map((status) =>
                this._historyService.listAllHistory({ status })
            )
        );
        const merged = (pages.flat() as unknown as OrderRow[]).sort(
            (left, right) =>
                Date.parse(String(right.createdAt ?? '')) -
                Date.parse(String(left.createdAt ?? ''))
        );
        const start = (this.page() - 1) * SCHEDULED_PAGE_SIZE;
        return {
            items: merged.slice(start, start + SCHEDULED_PAGE_SIZE),
            total: merged.length,
        };
    }

    /**
     * How many drafts the buyer is holding, so "all" can report a count that
     * matches what it renders.
     *
     * Without this the pager counts rows the tab has just filtered out and
     * offers a last page that comes back empty. A failed count is treated as
     * zero: an over-count is a cosmetic pager bug, while letting it throw would
     * cost the buyer the whole list.
     */
    private async _draftCount(): Promise<number> {
        try {
            const { items, total } = await this._historyService.listHistory({
                status: 'draft',
                page: 1,
            });
            return total ?? items.length;
        } catch {
            return 0;
        }
    }

    hasNextPage(): boolean {
        return this.page() * SCHEDULED_PAGE_SIZE < this.totalCount();
    }

    nextPage(): void {
        if (!this.hasNextPage()) {
            return;
        }
        this.page.update((p) => p + 1);
        this.load();
    }

    previousPage(): void {
        if (this.page() <= 1) {
            return;
        }
        this.page.update((p) => p - 1);
        this.load();
    }

    openOrder(row: OrderRow): void {
        const id = row.id ?? row.orderId;
        if (id) {
            void this._router.navigate(['/orders', id]);
        }
    }

    shortId(row: OrderRow): string {
        const id = row.id ?? row.orderId ?? '';
        return id ? id.slice(0, 8) : '—';
    }

    formatDate(value: string | null | undefined): string {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '—';
        }
        return date.toLocaleString(this._transloco.getActiveLang(), {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    }

    /**
     * `scheduledFor`'s clock time is always the same fixed early-morning hour
     * now (see `DELIVERY_HOUR` in `checkout.component.ts`) — the actual
     * delivery can land anywhere in that window, so this shows the date plus
     * the window instead of the stored instant's own minute, which would read
     * as an exact time.
     */
    formatScheduledFor(value: string | null | undefined): string {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '—';
        }
        const day = date.toLocaleDateString(this._transloco.getActiveLang());
        const window = this._transloco.translate('orders.deliveryWindow', {
            start: 4,
            end: 6,
        });
        return `${day} (${window})`;
    }

    formatAmount(value: number | null | undefined): string {
        if (value == null) {
            return '—';
        }
        return `${value.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }

    /**
     * `GET /orders` and `GET /orders/history` (this list's two scopes) return
     * `itemCount` per row, not the `items` array itself — that only comes back
     * from `GET /orders/{orderId}`. Falling back to `items?.length` covers any
     * row that did carry the full array (e.g. one already loaded elsewhere).
     */
    itemCount(row: OrderRow): number {
        return row.itemCount ?? row.items?.length ?? 0;
    }
}
