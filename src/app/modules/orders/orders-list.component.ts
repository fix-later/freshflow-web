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
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    RestaurantScheduledOrdersService,
    SCHEDULED_PAGE_SIZE,
} from 'app/modules/restaurant/scheduled-orders/scheduled-orders.service';
import {
    normalizeOrderStatus,
    OrderRow,
    orderStatusPillClass,
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

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(null);
        const request = this._historyService
            .listHistory({ status: 'delivered', page: this.page() })
            .then(({ items, total }) => {
                const delivered = (items as unknown as OrderRow[]).filter(
                    (order) =>
                        normalizeOrderStatus(order.status) === 'delivered'
                );
                return {
                    orders: delivered,
                    totalCount: total ?? delivered.length,
                };
            });

        request
            .then(({ orders, totalCount }) => {
                this.rows.set(orders);
                this.totalCount.set(totalCount);
            })
            .catch(async (err) => {
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
            .finally(() => this.loading.set(false));
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
