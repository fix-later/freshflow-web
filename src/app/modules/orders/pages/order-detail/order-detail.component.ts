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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { apiErrorMessage } from 'app/core/api/envelope';
import { OrdersService } from '../../orders.service';
import {
    canCancelOrder,
    normalizeOrderStatus,
    OrderRow,
    orderStatusPillClass,
} from '../../orders.types';

@Component({
    selector: 'order-detail',
    templateUrl: './order-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatSnackBarModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class OrderDetailComponent implements OnInit {
    private readonly _ordersService = inject(OrdersService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    readonly order = signal<OrderRow | null>(null);
    readonly loading = signal(false);
    readonly notFound = signal(false);
    readonly acting = signal(false);

    readonly statusPillClass = orderStatusPillClass;
    readonly statusKey = (status: string | null | undefined): string =>
        `orders.status.${normalizeOrderStatus(status) || 'unknown'}`;

    ngOnInit(): void {
        const orderId = this._route.snapshot.paramMap.get('orderId') ?? '';
        if (!orderId) {
            this.notFound.set(true);
            return;
        }
        this._fetch(orderId);
    }

    canCancel(): boolean {
        const order = this.order();
        return !!order && canCancelOrder(order.status);
    }

    cancel(): void {
        const order = this.order();
        if (!order?.id || this.acting()) {
            return;
        }
        this.acting.set(true);
        this._ordersService
            .cancelOrder(order.id)
            .then(() => {
                this._notify('orders.detail.cancelSuccess');
                this._fetch(order.id!, true);
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.acting.set(false));
    }

    reorder(): void {
        const order = this.order();
        if (!order?.id || this.acting()) {
            return;
        }
        this.acting.set(true);
        this._ordersService
            .reorder(order.id)
            .then(() => {
                this._notify('orders.detail.reorderSuccess');
                void this._router.navigate(['/profile'], {
                    queryParams: { tab: 'orders' },
                });
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.acting.set(false));
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

    private _fetch(orderId: string, keepVisible = false): void {
        if (!keepVisible) {
            this.loading.set(true);
        }
        this._ordersService
            .getOrder(orderId)
            .then((order) => {
                if (order) {
                    this.order.set(order);
                } else if (!keepVisible) {
                    this.notFound.set(true);
                }
            })
            .catch(() => {
                if (!keepVisible) {
                    this.notFound.set(true);
                }
            })
            .finally(() => this.loading.set(false));
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    private async _notifyError(err: unknown): Promise<void> {
        const message =
            (await apiErrorMessage(err)) ??
            this._transloco.translate('orders.detail.actionError');
        this._snackBar.open(message, undefined, { duration: 6000 });
    }
}
