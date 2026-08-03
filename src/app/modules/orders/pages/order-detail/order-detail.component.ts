import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { apiErrorMessage } from 'app/core/api/envelope';
import { OrdersService } from '../../orders.service';
import {
    canCancelOrder,
    normalizeOrderStatus,
    ORDER_ISSUE_TYPES,
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
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatSnackBarModule,
        ReactiveFormsModule,
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

    private readonly _fb = inject(FormBuilder);

    readonly order = signal<OrderRow | null>(null);
    readonly loading = signal(false);
    readonly notFound = signal(false);
    readonly acting = signal(false);

    readonly issueTypes = ORDER_ISSUE_TYPES;
    readonly issueOpen = signal(false);
    readonly issueError = signal<string | null>(null);
    readonly issueForm = this._fb.group({
        issueType: this._fb.nonNullable.control<string>(ORDER_ISSUE_TYPES[0], {
            validators: [Validators.required],
        }),
        orderItemId: this._fb.nonNullable.control(''),
        affectedQuantity: this._fb.control<number | null>(null),
        description: this._fb.nonNullable.control('', {
            validators: [Validators.required, Validators.maxLength(1000)],
        }),
    });

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

    /**
     * Receipt confirmation and issue reporting both open once the goods have
     * arrived. A delivery that failed leaves the order in `delivering`
     * (role-flows §7.4), so `delivered` is the only state that qualifies.
     */
    private _isDelivered(): boolean {
        return normalizeOrderStatus(this.order()?.status) === 'delivered';
    }

    canConfirmReceipt(): boolean {
        return this._isDelivered() && !this.receiptConfirmed();
    }

    canReportIssue(): boolean {
        return this._isDelivered();
    }

    /** True once the restaurant has acknowledged receipt of this order. */
    receiptConfirmed(): boolean {
        const order = this.order();
        return (
            !!order?.['receiptConfirmedAt'] ||
            order?.['receiptConfirmed'] === true
        );
    }

    confirmReceipt(): void {
        const order = this.order();
        if (!order?.id || this.acting() || !this.canConfirmReceipt()) {
            return;
        }
        this.acting.set(true);
        this._ordersService
            .confirmReceipt(order.id)
            .then(() => {
                this._notify('orders.detail.receiptSuccess');
                this._fetch(order.id!, true);
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.acting.set(false));
    }

    openIssue(): void {
        this.issueOpen.set(true);
        this.issueError.set(null);
    }

    closeIssue(): void {
        this.issueOpen.set(false);
        this.issueForm.reset({
            issueType: ORDER_ISSUE_TYPES[0],
            orderItemId: '',
            affectedQuantity: null,
            description: '',
        });
    }

    submitIssue(): void {
        const order = this.order();
        if (!order?.id || this.acting()) {
            return;
        }
        if (this.issueForm.invalid) {
            this.issueForm.markAllAsTouched();
            return;
        }
        const value = this.issueForm.getRawValue();
        this.acting.set(true);
        this.issueError.set(null);
        this._ordersService
            .reportIssue(order.id, {
                issueType: value.issueType,
                description: value.description.trim(),
                orderItemId: value.orderItemId || null,
                affectedQuantity: value.affectedQuantity,
            })
            .then(() => {
                this._notify('orders.detail.issueSuccess');
                this.closeIssue();
                this._fetch(order.id!, true);
            })
            .catch(async (err) => {
                this.issueError.set(
                    (await apiErrorMessage(err)) ??
                        this._transloco.translate('orders.detail.actionError')
                );
            })
            .finally(() => this.acting.set(false));
    }

    /** Line options for the issue form — an issue may name one order line. */
    issueLines(): { id: string; label: string }[] {
        const items = this.order()?.items;
        if (!Array.isArray(items)) {
            return [];
        }
        return items
            .map((item) => ({
                id: String(item.orderItemId ?? ''),
                label: String(
                    item.productNameSnapshot ?? item.orderItemId ?? ''
                ),
            }))
            .filter((line) => !!line.id);
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
