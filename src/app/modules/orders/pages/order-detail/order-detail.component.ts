import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    effect,
    inject,
    Injector,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { isImageFile } from 'app/core/api/cloudinary-upload';
import { describeApiError } from 'app/core/api/error-codes';

import {
    applyApiErrorToForm,
    clearServerErrors,
    fieldErrorKey,
    fieldMaxLength,
    serverError,
} from 'app/core/api/form-errors';
import {
    nonBlankValidator,
    trimmedMaxLengthValidator,
} from 'app/core/api/validators';
import { ApiLabelPipe } from 'app/core/i18n/api-label.pipe';
import { OrderRealtimeService } from 'app/core/realtime/order-realtime.service';
import { AccountShellComponent } from 'app/modules/restaurant/account-shell/account-shell.component';
import { RestaurantClaimsService } from 'app/modules/restaurant/claims/restaurant-claims.service';
import { ImageUploadTileComponent } from 'app/shared/image-upload-tile/image-upload-tile.component';
import {
    CLAIM_ELIGIBLE_ORDER_STATUSES,
    CLAIM_PROOF_IMAGE_URL_MAX_LENGTH,
    CLAIM_REASON_MAX_LENGTH,
} from '../../claims.types';
import { OrdersService } from '../../orders.service';
import {
    canCancelOrder,
    normalizeOrderStatus,
    OrderRow,
    orderStatusPillClass,
} from '../../orders.types';
import {
    claimAmountValidator,
    maxClaimAmountValidator,
    ORDER_TEXT_MAX_LENGTH,
    orderQuantityValidator,
    packingMultipleValidator,
} from '../../orders.validation';

@Component({
    selector: 'order-detail',
    templateUrl: './order-detail.component.html',
    styleUrl: './order-detail.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex w-full min-w-0 flex-auto flex-col' },
    imports: [
        AccountShellComponent,
        ApiLabelPipe,
        ImageUploadTileComponent,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
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
    private readonly _destroyRef = inject(DestroyRef);
    private readonly _claims = inject(RestaurantClaimsService);
    private readonly _realtime = inject(OrderRealtimeService);
    private readonly _injector = inject(Injector);

    readonly order = signal<OrderRow | null>(null);
    readonly loading = signal(false);
    readonly notFound = signal(false);
    readonly acting = signal(false);
    /**
     * Localized reason a read failed for something other than "no such order":
     * a 403 on someone else's order must not read as a 404.
     */
    readonly loadError = signal<string | null>(null);
    /** Localized reason the last action failed (409 status moved on, 422, …). */
    readonly actionError = signal<string | null>(null);

    /** Template helpers for per-field messages. */
    readonly errorKey = fieldErrorKey;
    readonly maxLength = fieldMaxLength;
    readonly serverMessage = serverError;

    /** Cancelling asks for a reason (`CancelOrderRequest.reason`, max 500). */
    readonly cancelOpen = signal(false);
    readonly cancelForm = this._fb.group({
        reason: this._fb.nonNullable.control('', {
            validators: [trimmedMaxLengthValidator(ORDER_TEXT_MAX_LENGTH)],
        }),
    });

    /** Draft line being edited, and the quantity typed for it. */
    readonly editingItemId = signal<string | null>(null);
    readonly quantityForm = this._fb.group({
        quantity: this._fb.control<number | null>(null, {
            validators: [
                Validators.required,
                orderQuantityValidator,
                packingMultipleValidator(() => this.editingItemPackSize()),
            ],
        }),
    });

    /**
     * Kg per case for the line currently being edited, from the packing weight
     * snapshotted onto it (`OrderItemDto.PackingWeightKg`). `null` when the
     * product declares no packing code, or on orders placed before the snapshot
     * existed — {@link packingMultipleValidator} then skips its check entirely.
     */
    editingItemPackSize(): number | null {
        const id = this.editingItemId();
        if (!id) {
            return null;
        }
        const item = this.order()?.items?.find((i) => i.orderItemId === id);
        const size = item?.['packingWeightKg'];
        return typeof size === 'number' && size > 0 ? size : null;
    }

    /**
     * Filing a claim (UC-ORD-21) — money back on an order that arrived short
     * or damaged, decided later by admin/ops against the restaurant's credit.
     *
     * The restaurant's only way to raise a problem with an order. Reporting an
     * incident is somebody else's job — the market agent, hub staff and driver
     * each report from their own console — so a second buyer-facing form that
     * recorded a complaint without asking for anything back was one form too
     * many on this page.
     */
    readonly claimOpen = signal(false);
    readonly claimError = signal<string | null>(null);
    readonly claimProofImageUrl = signal<string | null>(null);
    readonly claimProofUploading = signal(false);
    readonly claimForm = this._fb.group({
        amount: this._fb.control<number | null>(null, {
            // `GreaterThan(0m)` in the validator; the handler adds "not more
            // than the order was charged", which is checkable from the order
            // already on screen.
            validators: [
                Validators.required,
                claimAmountValidator,
                maxClaimAmountValidator(
                    () => this.order()?.totalAmount ?? null
                ),
            ],
        }),
        reason: this._fb.nonNullable.control('', {
            validators: [
                Validators.required,
                nonBlankValidator,
                trimmedMaxLengthValidator(CLAIM_REASON_MAX_LENGTH),
            ],
        }),
    });

    readonly statusPillClass = orderStatusPillClass;
    readonly statusKey = (status: string | null | undefined): string =>
        `orders.status.${normalizeOrderStatus(status) || 'unknown'}`;

    /**
     * A claim may be filed once the goods are with the buyer or at the hub
     * (`FileClaimCommandHandler`: `AtHub or Delivered`, else
     * `CLAIM_ORDER_NOT_CLAIMABLE`).
     */
    canFileClaim(): boolean {
        const status = normalizeOrderStatus(this.order()?.status);
        return (
            !!status &&
            (CLAIM_ELIGIBLE_ORDER_STATUSES as readonly string[]).includes(
                status
            )
        );
    }

    openClaim(): void {
        this.claimError.set(null);
        this.claimProofImageUrl.set(null);
        this.claimForm.reset({ amount: null, reason: '' });
        this.claimOpen.set(true);
    }

    closeClaim(): void {
        if (this.claimProofUploading()) {
            return;
        }
        this.claimOpen.set(false);
        this.claimProofImageUrl.set(null);
        this.claimForm.reset({ amount: null, reason: '' });
    }

    /** Uploads the selected evidence image while keeping the claim as a draft. */
    async uploadClaimProof(file: File): Promise<void> {
        const orderId = this.order()?.id;
        if (!orderId || this.claimProofUploading()) {
            return;
        }
        if (!isImageFile(file)) {
            this.claimError.set(
                this._transloco.translate('claims.proofNotAnImage')
            );
            return;
        }

        this.claimError.set(null);
        this.claimProofUploading.set(true);
        try {
            const url = await this._claims.uploadClaimProof(orderId, file);
            if (url.length > CLAIM_PROOF_IMAGE_URL_MAX_LENGTH) {
                throw new Error('Claim proof URL exceeds the backend limit.');
            }
            this.claimProofImageUrl.set(url);
        } catch (err) {
            this.claimError.set(
                await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'claims.proofUploadError'
                )
            );
        } finally {
            this.claimProofUploading.set(false);
        }
    }

    clearClaimProof(): void {
        if (!this.claimProofUploading()) {
            this.claimProofImageUrl.set(null);
        }
    }

    submitClaim(): void {
        const order = this.order();
        if (!order?.id || this.acting() || this.claimProofUploading()) {
            return;
        }
        if (this.claimForm.invalid) {
            this.claimForm.markAllAsTouched();
            return;
        }
        clearServerErrors(this.claimForm);
        const value = this.claimForm.getRawValue();
        this.acting.set(true);
        this.claimError.set(null);
        this._claims
            .fileClaim(
                order.id,
                value.amount ?? 0,
                value.reason.trim(),
                this.claimProofImageUrl()
            )
            .then(() => {
                this._notify('claims.filed');
                this.closeClaim();
            })
            .catch(async (err) => {
                const translate = (key: string): string =>
                    this._transloco.translate(key);
                const { handled } = await applyApiErrorToForm(
                    this.claimForm,
                    err,
                    translate
                );
                this.claimError.set(
                    handled
                        ? translate('errors.api.validation')
                        : await describeApiError(
                              err,
                              translate,
                              'claims.fileError'
                          )
                );
            })
            .finally(() => this.acting.set(false));
    }

    ngOnInit(): void {
        const orderId = this._route.snapshot.paramMap.get('orderId') ?? '';
        if (!orderId) {
            this.notFound.set(true);
            return;
        }
        this._fetch(orderId);
        this._goLive(orderId);
    }

    /**
     * Follows this one order on the order and delivery hubs.
     *
     * An event says *this order moved*, never what it now looks like — a status
     * broadcast carries no totals, no items, no proof URL — so the page re-reads
     * itself rather than patching a status into a body that would then disagree
     * with it. `keepVisible` keeps the current order on screen while it does,
     * so a status arriving does not blank the page the buyer is reading.
     */
    private _goLive(orderId: string): void {
        void this._realtime.connect();
        // Reconnected after a gap: events for this order may have come and gone
        // while the socket was down, and the hub replays none of them.
        this._realtime.setReconnectHandler(() => this._fetch(orderId, true));
        this._destroyRef.onDestroy(() => {
            this._realtime.setReconnectHandler(null);
            void this._realtime.disconnect();
        });

        effect(
            () => {
                const touched = this._realtime.touched();
                if (touched?.orderId === orderId) {
                    this._fetch(orderId, true);
                }
            },
            { injector: this._injector }
        );
    }

    canCancel(): boolean {
        const order = this.order();
        return !!order && canCancelOrder(order.status);
    }

    /**
     * Receipt confirmation opens once the goods have arrived. A delivery that
     * failed leaves the order in `delivering` (role-flows §7.4), so
     * `delivered` is the only state that qualifies.
     */
    private _isDelivered(): boolean {
        return normalizeOrderStatus(this.order()?.status) === 'delivered';
    }

    canConfirmReceipt(): boolean {
        return this._isDelivered() && !this.receiptConfirmed();
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
            .catch((err) => void this._reportAction(err))
            .finally(() => this.acting.set(false));
    }

    openCancel(): void {
        this.cancelForm.reset({ reason: '' });
        this.actionError.set(null);
        this.cancelOpen.set(true);
    }

    closeCancel(): void {
        this.cancelOpen.set(false);
    }

    cancel(): void {
        const order = this.order();
        if (!order?.id || this.acting()) {
            return;
        }
        clearServerErrors(this.cancelForm);
        if (this.cancelForm.invalid) {
            this.cancelForm.markAllAsTouched();
            return;
        }
        const reason = this.cancelForm.getRawValue().reason.trim();
        this.acting.set(true);
        this.actionError.set(null);
        this._ordersService
            .cancelOrder(order.id, reason || undefined)
            .then(() => {
                this._notify('orders.detail.cancelSuccess');
                this.cancelOpen.set(false);
                this._fetch(order.id!, true);
            })
            .catch((err) => void this._reportAction(err, this.cancelForm))
            .finally(() => this.acting.set(false));
    }

    /**
     * Lines are editable only while the order is still a draft — once it is
     * confirmed the backend answers 422, so the controls are not offered.
     */
    canEditItems(): boolean {
        return normalizeOrderStatus(this.order()?.status) === 'draft';
    }

    startEditItem(itemId: string, quantity: number | null | undefined): void {
        this.editingItemId.set(itemId);
        this.actionError.set(null);
        this.quantityForm.reset({ quantity: quantity ?? null });
    }

    cancelEditItem(): void {
        this.editingItemId.set(null);
    }

    saveItemQuantity(itemId: string): void {
        const order = this.order();
        if (!order?.id || this.acting()) {
            return;
        }
        clearServerErrors(this.quantityForm);
        if (this.quantityForm.invalid) {
            this.quantityForm.markAllAsTouched();
            return;
        }
        const quantity = Number(this.quantityForm.getRawValue().quantity);
        this.acting.set(true);
        this.actionError.set(null);
        this._ordersService
            .updateItemQuantity(order.id, itemId, quantity)
            .then(() => {
                this._notify('orders.detail.itemUpdated');
                this.editingItemId.set(null);
                this._fetch(order.id!, true);
            })
            .catch((err) => void this._reportAction(err, this.quantityForm))
            .finally(() => this.acting.set(false));
    }

    removeItem(itemId: string): void {
        const order = this.order();
        if (!order?.id || this.acting()) {
            return;
        }
        this.acting.set(true);
        this.actionError.set(null);
        this._ordersService
            .removeItem(order.id, itemId)
            .then(() => {
                this._notify('orders.detail.itemRemoved');
                this._fetch(order.id!, true);
            })
            .catch((err) => void this._reportAction(err))
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
                void this._router.navigate(['/orders']);
            })
            .catch((err) => void this._reportAction(err))
            .finally(() => this.acting.set(false));
    }

    /**
     * "Đặt định kỳ từ đơn này" — hands this order's items to the recurring-order
     * page's create form. Works for any order (including past/delivered ones,
     * same reach as reorder), and this order is left completely untouched —
     * same non-destructive convention as reorder.
     */
    goToRecurring(): void {
        const order = this.order();
        if (!order) {
            return;
        }
        // Merge by marketProductId — an order can carry more than one line for
        // the same product (repeat adds sum quantity rather than being
        // rejected), and the schedule's item picker treats marketProductId as
        // a unique key everywhere else.
        const merged = new Map<string, number>();
        for (const item of order.items ?? []) {
            if (!item.marketProductId || !item.quantity) {
                continue;
            }
            merged.set(
                item.marketProductId,
                (merged.get(item.marketProductId) ?? 0) + item.quantity
            );
        }
        void this._router.navigate(['/profile/scheduled'], {
            state: {
                prefillItems: Array.from(
                    merged,
                    ([marketProductId, quantity]) => ({
                        marketProductId,
                        quantity,
                    })
                ),
            },
        });
    }

    /**
     * The money the server actually charged, line by line.
     *
     * The page showed one figure — the grand total — so a restaurant reading
     * "27.277.750 ₫" could not tell what part of it was goods, what was VAT and
     * what was the trip. Every one of these is on the order (`OrderDto`:
     * `subtotalAmount`, `vatAmount`, `deliveryFee`); nothing here is worked
     * out on the client, because a total the buyer computes and a total the
     * server charges must never be able to disagree.
     */
    moneyLines(order: OrderRow): { labelKey: string; value: string }[] {
        const rows: { labelKey: string; value: number | null }[] = [
            {
                labelKey: 'orders.detail.subtotalAmount',
                value: this._num(order['subtotalAmount']),
            },
            {
                labelKey: 'orders.detail.vatAmount',
                value: this._num(order['vatAmount']),
            },
            {
                labelKey: 'orders.detail.deliveryFee',
                value: this._num(order['deliveryFee']),
            },
        ];
        return rows
            .filter(
                (row): row is { labelKey: string; value: number } =>
                    row.value !== null
            )
            .map((row) => ({
                labelKey: row.labelKey,
                value: this.formatAmount(row.value),
            }));
    }

    /** The address this order was delivered to, as the order recorded it. */
    deliveryAddress(order: OrderRow): {
        addressLine: string;
        recipientName: string;
        phone: string;
    } | null {
        const snapshot = order['deliveryAddress'];
        if (!snapshot || typeof snapshot !== 'object') {
            return null;
        }
        const row = snapshot as Record<string, unknown>;
        const addressLine = String(row['addressLine'] ?? '').trim();
        return addressLine
            ? {
                  addressLine,
                  recipientName: String(row['recipientName'] ?? '').trim(),
                  phone: String(row['phone'] ?? '').trim(),
              }
            : null;
    }

    /**
     * How far the delivery ran, when the order carries it — the figure the fee
     * was priced from, so it belongs beside the fee rather than nowhere.
     */
    deliveryDistance(order: OrderRow): string | null {
        const km = this._num(order['deliveryDistanceKm']);
        const metres = this._num(order['deliveryDistanceMeters']);
        const value = km ?? (metres !== null ? metres / 1000 : null);
        if (value === null || value <= 0) {
            return null;
        }
        return `${value.toLocaleString(this._transloco.getActiveLang(), {
            maximumFractionDigits: 1,
        })} km`;
    }

    /** True when the distance is an estimate rather than a routed measurement. */
    isDistanceEstimated(order: OrderRow): boolean {
        return order['deliveryDistanceEstimated'] === true;
    }

    /** The driver's photo of the drop, when there is one. */
    proofUrl(order: OrderRow): string | null {
        const url = String(order['proofUrl'] ?? '').trim();
        return url === '' ? null : url;
    }

    /** Dated moments this order actually reached, in the order they happen. */
    timeline(order: OrderRow): { labelKey: string; value: string }[] {
        const rows: { labelKey: string; raw: unknown }[] = [
            { labelKey: 'orders.detail.createdAt', raw: order.createdAt },
            {
                labelKey: 'orders.detail.confirmedAt',
                raw: order['confirmedAt'],
            },
            {
                labelKey: 'orders.detail.receiptConfirmedAt',
                raw: order['confirmedReceiptAt'],
            },
            { labelKey: 'orders.detail.cancelledAt', raw: order.cancelledAt },
        ];
        return rows
            .filter((row) => typeof row.raw === 'string' && row.raw !== '')
            .map((row) => ({
                labelKey: row.labelKey,
                value: this.formatDate(String(row.raw)),
            }));
    }

    private _num(value: unknown): number | null {
        return typeof value === 'number' && Number.isFinite(value)
            ? value
            : null;
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
            .catch(async (err) => {
                // 404 is "no such order"; 403 / 5xx / offline are not — those
                // get their own message so the page never lies about why.
                const message = await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'orders.detail.loadError'
                );
                if (keepVisible) {
                    this.actionError.set(message);
                    return;
                }
                const status = (err as { status?: number })?.status;
                if (status === 404) {
                    this.notFound.set(true);
                } else {
                    this.loadError.set(message);
                }
            })
            .finally(() => this.loading.set(false));
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    /**
     * Localizes an action failure, pins any per-field detail onto `form` when
     * one was given, and shows the rest inline **and** as a toast — the inline
     * banner survives long enough to read, the toast confirms it happened.
     */
    private async _reportAction(err: unknown, form?: FormGroup): Promise<void> {
        const translate = (key: string): string =>
            this._transloco.translate(key);
        if (form) {
            const { handled } = await applyApiErrorToForm(form, err, translate);
            if (handled) {
                this.actionError.set(translate('errors.api.validation'));
                return;
            }
        }
        const message = await describeApiError(
            err,
            translate,
            'orders.detail.actionError'
        );
        this.actionError.set(message);
        this._snackBar.open(message, undefined, { duration: 6000 });
    }
}
