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
import {
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { AdminService } from '../admin.service';
import { AdminOrderDetail } from '../admin.types';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import {
    canCancelOrder,
    normalizeOrderStatus,
    orderStatusPillClass,
} from './orders-list.component';

const DERIVED_ROW_KEYS = new Set(['orderId', 'items']);

/**
 * Admin ▸ Orders ▸ Detail — full order overview + cancel action. See
 * {@link OrdersListComponent} for the ROLE_MATRIX scope this covers.
 */
@Component({
    selector: 'admin-order-detail',
    templateUrl: './order-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class OrderDetailComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _dialog = inject(MatDialog);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _logistics = inject(LogisticsAdminService);

    private _cancelDialogRef: MatDialogRef<unknown> | null = null;

    readonly statusPillClass = orderStatusPillClass;
    readonly canCancel = canCancelOrder;

    readonly order = signal<AdminOrderDetail | null>(null);
    readonly loading = signal(false);
    readonly notFound = signal(false);
    readonly cancelSaving = signal(false);

    /**
     * The dispatch estimate for this order (distance / duration / fee) from
     * `GET /logistics/shipping/orders/{id}/estimate`. Read-only: it is what
     * logistics quotes, not something the console sets. A failure hides the
     * card rather than blocking the order — the order detail stands alone.
     */
    readonly shippingEstimate = signal<Record<string, unknown> | null>(null);
    readonly estimateError = signal<string | null>(null);
    readonly cancelReason = new FormControl('', { nonNullable: true });

    ngOnInit(): void {
        const id = this._route.snapshot.paramMap.get('orderId') ?? '';
        const passed = (history.state?.order ??
            null) as AdminOrderDetail | null;
        if (passed && passed.orderId === id) {
            this.order.set(passed);
        } else if (id) {
            this._fetch(id);
        } else {
            this.notFound.set(true);
        }
    }

    goBack(): void {
        void this._router.navigate(['/admin/orders']);
    }

    openCancel(template: TemplateRef<unknown>): void {
        if (!this.canCancel(this.order()?.status) || this._cancelDialogRef) {
            return;
        }
        this.cancelReason.reset('');
        this.cancelSaving.set(false);
        this._cancelDialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._cancelDialogRef.afterClosed().subscribe(() => {
            this._cancelDialogRef = null;
        });
    }

    closeCancel(): void {
        this._cancelDialogRef?.close();
    }

    confirmCancel(): void {
        const id = this.order()?.orderId;
        if (!id) {
            return;
        }
        this.cancelSaving.set(true);
        this._admin
            .cancelOrder(id, this.cancelReason.value.trim() || undefined)
            .then(() => {
                this._notify('admin.orders.cancel.success');
                this.closeCancel();
                this._fetch(id);
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.cancelSaving.set(false));
    }

    detailEntries(row: AdminOrderDetail): { label: string; value: string }[] {
        return this._rawScalars(row)
            .filter(([key]) => !DERIVED_ROW_KEYS.has(key))
            .map(([key, value]) => ({
                label: this._fieldLabel('orderField', key),
                value: this._displayValue(key, value),
            }));
    }

    itemsOf(row: AdminOrderDetail | null): Record<string, unknown>[] {
        const items = row?.items;
        return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
    }

    itemEntries(
        item: Record<string, unknown>
    ): { label: string; value: string }[] {
        return this._rawScalars(item).map(([key, value]) => ({
            label: this._fieldLabel('itemField', key),
            value: this._displayValue(key, value),
        }));
    }

    statusLabel(status: string | null | undefined): string {
        const normalized = normalizeOrderStatus(status);
        if (!normalized) {
            return '—';
        }
        const key = `admin.orders.status.${normalized}`;
        const translated = this._transloco.translate(key);
        return translated === key ? String(status) : translated;
    }

    private _fetch(id: string): void {
        this.loading.set(true);
        this._admin
            .getOrder(id)
            .then((row) => {
                this.order.set(row);
                this.notFound.set(!row);
                if (row) {
                    this._fetchEstimate(id);
                }
            })
            .catch(() => this.notFound.set(true))
            .finally(() => this.loading.set(false));
    }

    /** Rows of the estimate card — whatever scalars the endpoint returned. */
    estimateEntries(): { label: string; value: string }[] {
        // Live shape: { orderId, totalBoxes, totalLoadKg, boxTareKg, vehicleId,
        // vehicleCapacityKg, fitsVehicle, lines[], missingPackingCode[] }.
        // `orderId` is the page you are already on, so it is dropped.
        return this._rawScalars(this.shippingEstimate())
            .filter(([key]) => key !== 'orderId')
            .map(([key, value]) => ({
                label: this._humanize(key),
                value: value == null ? '—' : String(value),
            }));
    }

    private _fetchEstimate(orderId: string): void {
        this.estimateError.set(null);
        void this._logistics
            .getShippingEstimate(orderId)
            .then((estimate) => this.shippingEstimate.set(estimate))
            .catch(async (err) => {
                this.shippingEstimate.set(null);
                this.estimateError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.orders.estimate.error'
                    )
                );
            });
    }

    private _rawScalars(obj: unknown): [string, unknown][] {
        if (!obj || typeof obj !== 'object') {
            return [];
        }
        return Object.entries(obj as Record<string, unknown>).filter(
            ([, v]) =>
                v === null ||
                v === undefined ||
                ['string', 'number', 'boolean'].includes(typeof v)
        );
    }

    private _humanize(key: string): string {
        const spaced = key
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\bId\b/gi, 'ID')
            .trim();
        return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    }

    private _fieldLabel(
        scope: 'orderField' | 'itemField',
        key: string
    ): string {
        const translated = this._transloco.translate(
            `admin.orders.${scope}.${key}`
        );
        return translated === `admin.orders.${scope}.${key}`
            ? this._humanize(key)
            : translated;
    }

    private _displayValue(key: string, value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        if (key === 'status') {
            return this.statusLabel(String(value));
        }
        if (key === 'paymentStatus') {
            const token = normalizeOrderStatus(String(value));
            const translated = this._transloco.translate(
                `admin.orders.paymentStatus.${token}`
            );
            return translated === `admin.orders.paymentStatus.${token}`
                ? String(value)
                : translated;
        }
        if (typeof value === 'boolean') {
            return value ? '✓' : '✗';
        }
        if (
            typeof value === 'number' &&
            /(amount|price|total|subtotal)/i.test(key)
        ) {
            return `${value.toLocaleString(this._transloco.getActiveLang())} ₫`;
        }
        if (typeof value === 'string' && /(At|Date|For)$/.test(key)) {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                return date.toLocaleString(this._transloco.getActiveLang());
            }
        }
        return String(value);
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    private async _notifyError(err: unknown): Promise<void> {
        const message = await describeApiError(
            err,
            (key) => this._transloco.translate(key),
            'admin.orders.actionError'
        );
        this._snackBar.open(message, undefined, { duration: 5000 });
    }
}
