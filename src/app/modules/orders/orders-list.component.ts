import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { RestaurantScheduledOrdersService } from 'app/modules/restaurant/scheduled-orders/scheduled-orders.service';
import { OrdersService } from './orders.service';
import {
    normalizeOrderStatus,
    ORDER_STATUSES,
    OrderRow,
    orderStatusPillClass,
} from './orders.types';

const PAGE_SIZE = 10;

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
        MatFormFieldModule,
        MatIconModule,
        MatProgressBarModule,
        MatSelectModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class OrdersListComponent implements OnInit {
    private readonly _ordersService = inject(OrdersService);
    private readonly _historyService = inject(RestaurantScheduledOrdersService);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly statuses = ORDER_STATUSES;
    readonly statusPillClass = orderStatusPillClass;
    readonly statusKey = (status: string | null | undefined): string =>
        `orders.status.${normalizeOrderStatus(status) || 'unknown'}`;

    readonly rows = signal<OrderRow[]>([]);
    readonly loading = signal(false);
    /** Localized reason the list read failed (400 bad filter, 403, 5xx…). */
    readonly loadError = signal<string | null>(null);
    readonly totalCount = signal(0);
    readonly page = signal(1);
    readonly statusFilter = signal('');

    /**
     * Which list this is showing. `GET /orders` is the live working set;
     * `GET /orders/history` is the archive (UC-ORD-17) — two endpoints, one
     * screen, because to a buyer they are the same list at different ages.
     */
    readonly scope = signal<'active' | 'history'>('active');

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(null);
        const request =
            this.scope() === 'history'
                ? this._historyService
                      .listHistory({
                          status: this.statusFilter() || undefined,
                          page: this.page(),
                      })
                      .then(({ items, total }) => ({
                          orders: items as unknown as OrderRow[],
                          totalCount: total ?? items.length,
                      }))
                : this._ordersService.listOrders({
                      status: this.statusFilter() || undefined,
                      page: this.page(),
                      pageSize: PAGE_SIZE,
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

    /** Switches between the live orders and the archive, resetting paging. */
    onScopeChange(scope: 'active' | 'history'): void {
        if (this.scope() === scope) {
            return;
        }
        this.scope.set(scope);
        this.page.set(1);
        this.load();
    }

    onStatusChange(status: string): void {
        this.statusFilter.set(status);
        this.page.set(1);
        this.load();
    }

    hasNextPage(): boolean {
        return this.page() * PAGE_SIZE < this.totalCount();
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
        void this._router.navigate(['/orders', row.id]);
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

    formatAmount(value: number | null | undefined): string {
        if (value == null) {
            return '—';
        }
        return `${value.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }

    itemCount(row: OrderRow): number {
        return row.items?.length ?? 0;
    }
}
