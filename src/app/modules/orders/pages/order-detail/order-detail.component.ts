import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { RestaurantClaimsService } from 'app/modules/restaurant/claims/restaurant-claims.service';
import {
    CLAIM_ELIGIBLE_ORDER_STATUSES,
    CLAIM_REASON_MAX_LENGTH,
} from '../../claims.types';
import { OrdersService } from '../../orders.service';
import {
    canCancelOrder,
    normalizeOrderStatus,
    ORDER_ISSUE_TYPES,
    OrderRow,
    orderStatusPillClass,
} from '../../orders.types';
import {
    affectedQuantityValidator,
    claimAmountValidator,
    maxAffectedQuantityValidator,
    maxClaimAmountValidator,
    ORDER_ISSUE_DESCRIPTION_MAX_LENGTH,
    ORDER_TEXT_MAX_LENGTH,
    orderQuantityValidator,
} from '../../orders.validation';

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
            validators: [Validators.required, orderQuantityValidator],
        }),
    });

    readonly issueTypes = ORDER_ISSUE_TYPES;
    readonly issueOpen = signal(false);
    readonly issueError = signal<string | null>(null);
    readonly issueForm = this._fb.group({
        issueType: this._fb.nonNullable.control<string>(ORDER_ISSUE_TYPES[0], {
            validators: [Validators.required],
        }),
        orderItemId: this._fb.nonNullable.control(''),
        affectedQuantity: this._fb.control<number | null>(null, {
            // The handler rejects `<= 0`, and — once a line is named — anything
            // above what was ordered. The second rule is checkable here because
            // the order is already on screen, so "you only ordered 3" is said
            // at the field instead of coming back as a 422.
            validators: [
                Validators.required,
                affectedQuantityValidator,
                maxAffectedQuantityValidator(() => this.selectedLineQuantity()),
            ],
        }),
        description: this._fb.nonNullable.control('', {
            // `OrderIssue.MaxDescriptionLength` is 1000 — this field is the one
            // order text that is *not* capped at 500.
            validators: [
                Validators.required,
                trimmedMaxLengthValidator(ORDER_ISSUE_DESCRIPTION_MAX_LENGTH),
            ],
        }),
    });

    /**
     * Filing a claim (UC-ORD-21) — money back on an order that arrived short or
     * damaged, decided later by admin/ops against the restaurant's credit.
     * Separate from an issue report: an issue is a record, a claim is a request
     * for a refund, and only the claim needs an amount.
     */
    readonly claimOpen = signal(false);
    readonly claimError = signal<string | null>(null);
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
     * `CLAIM_ORDER_NOT_CLAIMABLE`). Wider than the issue report, which is
     * delivered-only.
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
        this.claimForm.reset({ amount: null, reason: '' });
        this.claimOpen.set(true);
    }

    closeClaim(): void {
        this.claimOpen.set(false);
        this.claimForm.reset({ amount: null, reason: '' });
    }

    submitClaim(): void {
        const order = this.order();
        if (!order?.id || this.acting()) {
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
            .fileClaim(order.id, value.amount ?? 0, value.reason.trim())
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
        // Switching the line the issue is about changes the ceiling on
        // `affectedQuantity`, so the already-typed number is re-judged against
        // the new line instead of keeping a verdict from the previous one.
        this.issueForm.controls.orderItemId.valueChanges
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe(() =>
                this.issueForm.controls.affectedQuantity.updateValueAndValidity()
            );

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
            .catch((err) => void this._reportAction(err))
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
                const translate = (key: string): string =>
                    this._transloco.translate(key);
                const { handled } = await applyApiErrorToForm(
                    this.issueForm,
                    err,
                    translate
                );
                this.issueError.set(
                    handled
                        ? translate('errors.api.validation')
                        : await describeApiError(
                              err,
                              translate,
                              'orders.detail.actionError'
                          )
                );
            })
            .finally(() => this.acting.set(false));
    }

    /** Line options for the issue form — an issue may name one order line. */
    issueLines(): { id: string; label: string; quantity: number | null }[] {
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
                quantity:
                    typeof item.quantity === 'number' ? item.quantity : null,
            }))
            .filter((line) => !!line.id);
    }

    /**
     * How much of the selected line was ordered — the ceiling the handler puts
     * on `affectedQuantity`. `null` when the report covers the whole order (no
     * line named), which the handler leaves unbounded.
     */
    selectedLineQuantity(): number | null {
        const id = this.issueForm?.controls.orderItemId.value;
        if (!id) {
            return null;
        }
        return (
            this.issueLines().find((line) => line.id === id)?.quantity ?? null
        );
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
