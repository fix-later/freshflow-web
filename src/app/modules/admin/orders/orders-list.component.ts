import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    TemplateRef,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { DateTime } from 'luxon';
import { AdminService } from '../admin.service';
import {
    AdminOrderDetail,
    ORDER_NOT_CANCELLABLE_STATUSES,
} from '../admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import {
    ADMIN_DEFAULT_PAGE_SIZE,
    toApiPage,
    toPageIndex,
} from '../shared/admin-pagination';
import { CoalescedTask } from '../shared/coalesced-task';

const ORDER_STATUSES = [
    'pending',
    'confirmed',
    'processing',
    'ready_for_pickup',
    'in_transit',
    'delivered',
    'cancelled',
];

/** Pill class for an order status — same lifecycle-coloring idiom used elsewhere. */
export function orderStatusPillClass(
    status: string | null | undefined
): string {
    switch (String(status ?? '').toLowerCase()) {
        case 'delivered':
            return 'admin-pill admin-pill-success';
        case 'cancelled':
            return 'admin-pill admin-pill-danger';
        case 'processing':
        case 'in_transit':
            return 'admin-pill admin-pill-warning';
        case 'ready_for_pickup':
            return 'admin-pill admin-pill-cyan';
        case 'confirmed':
            return 'admin-pill admin-pill-purple';
        case 'pending':
            return 'admin-pill admin-pill-info';
        default:
            return 'admin-pill admin-pill-neutral';
    }
}

/** Whether an order can still be cancelled (BR: not processing/in_transit/delivered). */
export function canCancelOrder(status: string | null | undefined): boolean {
    return !ORDER_NOT_CANCELLABLE_STATUSES.has(
        String(status ?? '').toLowerCase()
    );
}

/**
 * Admin ▸ Orders — every restaurant's orders (M5 Orders: "View all orders" is
 * `R` for Admin; cancelling any order in a cancellable status is Admin's one
 * documented override — see `PATCH /orders/{orderId}/cancel`).
 */
@Component({
    selector: 'admin-orders-list',
    templateUrl: './orders-list.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatDatepickerModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
    styles: [
        `
            .orders-grid {
                grid-template-columns:
                    minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr)
                    minmax(0, 0.9fr) minmax(0, 0.9fr) 6rem;
            }
        `,
    ],
})
export class OrdersListComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _router = inject(Router);
    private readonly _dialog = inject(MatDialog);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    readonly statusPillClass = orderStatusPillClass;
    readonly canCancel = canCancelOrder;
    readonly statuses = ORDER_STATUSES;

    private _cancelDialogRef: MatDialogRef<unknown> | null = null;

    readonly orders = signal<AdminOrderDetail[]>([]);
    readonly totalCount = signal(0);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    readonly loading = signal(false);
    readonly cancelSaving = signal(false);

    readonly restaurantId = new FormControl('', { nonNullable: true });
    readonly status = new FormControl('', { nonNullable: true });
    readonly from = new FormControl<DateTime | null>(null);
    readonly to = new FormControl<DateTime | null>(null);

    readonly cancelTarget = signal<AdminOrderDetail | null>(null);
    readonly cancelReason = new FormControl('', { nonNullable: true });

    ngOnInit(): void {
        this._load();
        const onFilterChange = (): void => {
            this.pageIndex.set(0);
            this._load();
        };
        this.restaurantId.valueChanges.subscribe(onFilterChange);
        this.status.valueChanges.subscribe(onFilterChange);
        this.from.valueChanges.subscribe(onFilterChange);
        this.to.valueChanges.subscribe(onFilterChange);
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
        this._load();
    }

    openDetail(row: AdminOrderDetail): void {
        const id = row.orderId ?? '';
        if (!id) {
            return;
        }
        this._router.navigate(['/admin/orders', id], { state: { order: row } });
    }

    trackById(index: number, row: AdminOrderDetail): string {
        return row.orderId || String(index);
    }

    formatDate(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleString(this._transloco.getActiveLang());
    }

    money(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        const amount = Number(value);
        return Number.isNaN(amount)
            ? String(value)
            : `${amount.toLocaleString(this._transloco.getActiveLang())} ₫`;
    }

    openCancel(row: AdminOrderDetail, template: TemplateRef<unknown>): void {
        if (!this.canCancel(row.status) || this._cancelDialogRef) {
            return;
        }
        this.cancelTarget.set(row);
        this.cancelReason.reset('');
        this.cancelSaving.set(false);
        this._cancelDialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._cancelDialogRef.afterClosed().subscribe(() => {
            this._cancelDialogRef = null;
            this.cancelTarget.set(null);
        });
    }

    closeCancel(): void {
        this._cancelDialogRef?.close();
    }

    confirmCancel(): void {
        const id = this.cancelTarget()?.orderId;
        if (!id) {
            return;
        }
        this.cancelSaving.set(true);
        this._admin
            .cancelOrder(id, this.cancelReason.value.trim() || undefined)
            .then(() => {
                this._notify('admin.orders.cancel.success');
                this.closeCancel();
                this._load();
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.cancelSaving.set(false));
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    private _isoDate(
        control: FormControl<DateTime | null>
    ): string | undefined {
        const value = control.value;
        return value && DateTime.isDateTime(value) && value.isValid
            ? value.toISODate() ?? undefined
            : undefined;
    }

    private _load(): void {
        this._loadTask.trigger();
    }

    private readonly _loadTask = new CoalescedTask(async () => {
        this.loading.set(true);
        try {
            const result = await this._admin.getOrders({
                restaurantId: this.restaurantId.value.trim() || undefined,
                status: this.status.value || undefined,
                from: this._isoDate(this.from),
                to: this._isoDate(this.to),
                page: toApiPage(this.pageIndex()),
                pageSize: this.pageSize(),
            });
            this.orders.set(result.orders);
            this.totalCount.set(result.totalCount);
            if (result.page) {
                this.pageIndex.set(toPageIndex(result.page));
            }
            if (result.pageSize) {
                this.pageSize.set(result.pageSize);
            }
        } catch {
            this.orders.set([]);
            this.totalCount.set(0);
        } finally {
            this.loading.set(false);
        }
    });

    private async _notifyError(err: unknown): Promise<void> {
        const message = await describeApiError(
            err,
            (key) => this._transloco.translate(key),
            'admin.orders.actionError'
        );
        this._snackBar.open(message, undefined, { duration: 5000 });
    }
}
