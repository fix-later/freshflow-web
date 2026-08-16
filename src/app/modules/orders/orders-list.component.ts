import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    RestaurantScheduledOrdersService,
    SCHEDULED_PAGE_SIZE,
} from 'app/modules/restaurant/scheduled-orders/scheduled-orders.service';
import {
    normalizeOrderStatus,
    ORDER_STATUS_TABS,
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

    /** The i18n key for a tab's label — the status labels do double duty. */
    tabLabelKey(tab: OrderStatusTab): string {
        return tab === 'all' ? 'orders.tabs.all' : `orders.status.${tab}`;
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
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(null);
        const tab = this.activeTab();
        const token = ++this._loadToken;

        this._historyService
            .listHistory({
                status: tab === 'all' ? undefined : tab,
                page: this.page(),
            })
            .then(({ items, total }) => {
                if (token !== this._loadToken) {
                    return;
                }
                const orders = items as unknown as OrderRow[];
                this.rows.set(orders);
                this.totalCount.set(total ?? orders.length);
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
