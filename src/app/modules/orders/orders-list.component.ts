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
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly statuses = ORDER_STATUSES;
    readonly statusPillClass = orderStatusPillClass;
    readonly statusKey = (status: string | null | undefined): string =>
        `orders.status.${normalizeOrderStatus(status) || 'unknown'}`;

    readonly rows = signal<OrderRow[]>([]);
    readonly loading = signal(false);
    readonly loadError = signal(false);
    readonly totalCount = signal(0);
    readonly page = signal(1);
    readonly statusFilter = signal('');

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(false);
        this._ordersService
            .listOrders({
                status: this.statusFilter() || undefined,
                page: this.page(),
                pageSize: PAGE_SIZE,
            })
            .then(({ orders, totalCount }) => {
                this.rows.set(orders);
                this.totalCount.set(totalCount);
            })
            .catch(() => this.loadError.set(true))
            .finally(() => this.loading.set(false));
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

    formatDate(value: string | null | undefined): string {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? '—'
            : date.toLocaleString(this._transloco.getActiveLang());
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
