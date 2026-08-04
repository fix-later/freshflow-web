import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    TemplateRef,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
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
import {
    AdminOrderDetail,
    AdminOrderItem,
    ORDER_ADVANCE_NEXT_STATUS,
    ORDER_NOT_ADJUSTABLE_STATUSES,
} from '../admin.types';
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

    // ---- Ops actions (admin,operations_manager) ---------------------------

    /** Item currently being adjusted, and the value typed for it. */
    readonly adjustingItemId = signal<string | null>(null);
    readonly adjustQuantity = new FormControl<number | null>(null);
    readonly adjustSaving = signal(false);
    readonly advancing = signal(false);

    /**
     * Localized reason the last ops action was refused. A snackbar alone
     * disappears before an operator recording a shortage has finished reading
     * it, so the reason also stays pinned next to the control that caused it.
     */
    readonly actionError = signal<string | null>(null);

    /** Normalized current status — every gate below keys off this. */
    readonly status = computed(() =>
        normalizeOrderStatus(this.order()?.status)
    );

    /**
     * The one stage this order may be advanced to, or `null` when none is
     * legal. Mirrors the backend state machine exactly (see
     * {@link ORDER_ADVANCE_NEXT_STATUS}) so the button is absent rather than
     * offering a transition the server would reject.
     */
    readonly nextStatus = computed(
        () => ORDER_ADVANCE_NEXT_STATUS[this.status()] ?? null
    );

    /** `Order.RecordActualQuantity` refuses draft/cancelled orders (409). */
    readonly canAdjust = computed(
        () =>
            !!this.order() && !ORDER_NOT_ADJUSTABLE_STATUSES.has(this.status())
    );

    /**
     * Why adjusting is unavailable, so a disabled section explains itself
     * instead of just being inert.
     */
    readonly adjustBlockedReason = computed(() => {
        const status = this.status();
        if (!status || this.canAdjust()) {
            return null;
        }
        return status === 'draft'
            ? 'admin.orders.adjust.blockedDraft'
            : 'admin.orders.adjust.blockedCancelled';
    });

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

    // ---- Record actual quantity (UC-ORD-16/17) ----------------------------

    /** The ordered quantity an adjustment may not exceed (BE: `> item.Quantity` → 422). */
    orderedQuantity(item: AdminOrderItem): number {
        const raw = Number(item['quantity']);
        return Number.isFinite(raw) && raw > 0 ? raw : 0;
    }

    itemIdOf(item: AdminOrderItem): string {
        const raw = item['orderItemId'] ?? item['id'];
        return raw == null ? '' : String(raw);
    }

    isAdjusting(item: AdminOrderItem): boolean {
        return this.adjustingItemId() === this.itemIdOf(item);
    }

    startAdjust(item: AdminOrderItem): void {
        const id = this.itemIdOf(item);
        if (!id || !this.canAdjust()) {
            return;
        }
        this.actionError.set(null);
        const current = item['actualQuantity'];
        this.adjustQuantity.setValue(
            current == null ? this.orderedQuantity(item) : Number(current)
        );
        // Bounds are per-item, so they are applied when the row opens rather
        // than once at construction.
        this.adjustQuantity.setValidators([
            Validators.required,
            Validators.min(0),
            Validators.max(this.orderedQuantity(item)),
        ]);
        this.adjustQuantity.updateValueAndValidity();
        this.adjustingItemId.set(id);
    }

    cancelAdjust(): void {
        this.adjustingItemId.set(null);
        this.adjustQuantity.reset(null);
        this.adjustQuantity.clearValidators();
        this.adjustQuantity.updateValueAndValidity();
        this.actionError.set(null);
    }

    /**
     * The client-side verdict on the typed quantity, as an i18n key — the same
     * three rules the backend enforces (`NotEmpty`, `>= 0`,
     * `<= item.Quantity`), so the request is only sent when it can succeed.
     */
    adjustErrorKey(item: AdminOrderItem): string | null {
        const value = this.adjustQuantity.value;
        if (value === null || (value as unknown) === '') {
            return 'admin.orders.adjust.required';
        }
        const amount = Number(value);
        if (!Number.isFinite(amount)) {
            return 'admin.orders.adjust.required';
        }
        if (amount < 0) {
            return 'admin.orders.adjust.negative';
        }
        if (amount > this.orderedQuantity(item)) {
            return 'admin.orders.adjust.exceedsOrdered';
        }
        return null;
    }

    canSubmitAdjust(item: AdminOrderItem): boolean {
        return (
            this.canAdjust() &&
            !this.adjustSaving() &&
            this.adjustErrorKey(item) === null
        );
    }

    submitAdjust(item: AdminOrderItem): void {
        const orderId = this.order()?.orderId;
        const itemId = this.itemIdOf(item);
        if (!orderId || !itemId || !this.canSubmitAdjust(item)) {
            this.adjustQuantity.markAsTouched();
            return;
        }
        this.actionError.set(null);
        this.adjustSaving.set(true);
        this._admin
            .recordActualQuantity(
                orderId,
                itemId,
                Number(this.adjustQuantity.value)
            )
            .then((updated) => {
                this._notify('admin.orders.adjust.success');
                this.cancelAdjust();
                // The response carries the recalculated order; fall back to a
                // re-read if the endpoint answered without a body.
                if (updated) {
                    this.order.set(updated);
                } else {
                    this._fetch(orderId);
                }
            })
            .catch(
                (err) =>
                    void this._reportActionError(
                        err,
                        'admin.orders.adjust.error'
                    )
            )
            .finally(() => this.adjustSaving.set(false));
    }

    // ---- Advance status (ops bridge) --------------------------------------

    /** Localized label of the stage this order would move to next. */
    nextStatusLabel(): string {
        const next = this.nextStatus();
        return next ? this.statusLabel(next) : '—';
    }

    advance(): void {
        const orderId = this.order()?.orderId;
        const next = this.nextStatus();
        if (!orderId || !next || this.advancing()) {
            return;
        }
        this.actionError.set(null);
        this.advancing.set(true);
        this._admin
            .advanceOrderStatus(orderId, next)
            .then((updated) => {
                this._notify('admin.orders.advance.success');
                if (updated) {
                    this.order.set(updated);
                } else {
                    this._fetch(orderId);
                }
            })
            .catch(
                (err) =>
                    void this._reportActionError(
                        err,
                        'admin.orders.advance.error'
                    )
            )
            .finally(() => this.advancing.set(false));
    }

    detailEntries(row: AdminOrderDetail): { label: string; value: string }[] {
        return this._rawScalars(row)
            .filter(([key]) => !DERIVED_ROW_KEYS.has(key))
            .map(([key, value]) => ({
                label: this._fieldLabel('orderField', key),
                value: this._displayValue(key, value),
            }));
    }

    itemsOf(row: AdminOrderDetail | null): AdminOrderItem[] {
        const items = row?.items;
        return Array.isArray(items) ? items : [];
    }

    itemEntries(item: AdminOrderItem): { label: string; value: string }[] {
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

    /**
     * Shows why an ops action was refused, both inline (so it survives long
     * enough to act on) and as a toast. Every documented rejection resolves to
     * its own localized sentence via `describeApiError` +
     * `API_ERROR_MESSAGE_KEYS` — `ORDER_CANNOT_ADJUST`,
     * `INVALID_ACTUAL_QUANTITY`, `ORDER_ITEM_NOT_FOUND`,
     * `ORDER_INVALID_TRANSITION` and `ORDER_NOT_FOUND` included.
     */
    private async _reportActionError(
        err: unknown,
        fallbackKey: string
    ): Promise<void> {
        const message = await describeApiError(
            err,
            (key) => this._transloco.translate(key),
            fallbackKey
        );
        this.actionError.set(message);
        this._snackBar.open(message, undefined, { duration: 6000 });
    }
}
