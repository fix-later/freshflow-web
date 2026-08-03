import { DecimalPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { apiErrorMessage } from 'app/core/api/envelope';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { DraftOrderLine } from 'app/layout/common/draft-order/draft-order.types';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { OrdersService } from 'app/modules/orders/orders.service';
import { RestaurantProfileService } from 'app/modules/restaurant/restaurant-profile.service';
import { DateTime } from 'luxon';

/** Daily order cutoff (BR-ORD-2): 22:00 — after this, earliest delivery +1 extra day. */
const CUTOFF_HOUR = 22;

function addCalendarDays(base: Date, days: number): Date {
    const next = new Date(base);
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() + days);
    return next;
}

/**
 * Earliest selectable delivery date:
 * - before 22:00 → tomorrow (today + 1)
 * - 22:00–24:00 → day after tomorrow (today + 2)
 */
export function earliestDeliveryDate(now = new Date()): Date {
    const afterCutoff = now.getHours() >= CUTOFF_HOUR;
    return addCalendarDays(now, afterCutoff ? 2 : 1);
}

function toLuxonDay(date: Date): DateTime {
    return DateTime.fromJSDate(date).startOf('day');
}

@Component({
    selector: 'checkout',
    templateUrl: './checkout.component.html',
    styleUrls: ['./cart.component.scss', './checkout.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        DecimalPipe,
        FormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatDatepickerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatSnackBarModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class CheckoutComponent implements OnInit {
    private readonly _router = inject(Router);
    private readonly _draftOrder = inject(DraftOrderService);
    private readonly _transloco = inject(TranslocoService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _orders = inject(OrdersService);
    private readonly _restaurantProfile = inject(RestaurantProfileService);

    readonly lines = this._draftOrder.lines;
    readonly subtotal = this._draftOrder.subtotal;

    readonly placed = signal(false);
    readonly submitting = signal(false);
    /** Reasons the server refused to confirm, from `confirm-preview`. */
    readonly blockers = signal<string[]>([]);
    readonly voucherOpen = signal(false);
    readonly couponCode = signal('');
    readonly appliedCoupon = signal<string | null>(null);
    readonly freshQualityNote = signal(true);
    readonly extraNote = signal('');

    /**
     * Earliest day the restaurant may pick. Seeded from the local 22:00 rule
     * so the picker works offline, then corrected by
     * `GET /orders/ordering-window` — the server owns the real cutoff.
     */
    readonly minDeliveryDate = signal(toLuxonDay(earliestDeliveryDate()));

    readonly deliveryDate = signal<DateTime>(this.minDeliveryDate());
    readonly deliverySlot = signal('09:00-11:00');

    readonly afterCutoff = signal(new Date().getHours() >= CUTOFF_HOUR);

    readonly deliverySlots = [
        '06:00-08:00',
        '09:00-11:00',
        '14:00-16:00',
        '16:00-18:00',
    ] as const;

    /** The restaurant's default saved delivery address, once loaded. */
    readonly defaultAddress = computed(
        () =>
            this._restaurantProfile.defaultDeliveryAddress()?.addressLine ??
            null
    );

    readonly discount = computed(() => {
        if (!this.appliedCoupon()) {
            return 0;
        }
        return Math.round(this.subtotal() * 0.1);
    });

    /** Goods total before tax (after coupon). */
    readonly goodsBeforeTax = computed(() =>
        Math.max(0, this.subtotal() - this.discount())
    );

    readonly vat = computed(() => Math.round(this.goodsBeforeTax() * 0.08));

    readonly total = computed(() => this.goodsBeforeTax() + this.vat());

    readonly isVi = computed(() => this._transloco.getActiveLang() === 'vi');

    ngOnInit(): void {
        if (!this.lines().length && !this.placed()) {
            void this._router.navigateByUrl('/cart');
        }
        this._restaurantProfile.loadDeliveryAddresses().catch(() => {
            // The summary just shows no address; not fatal to checkout.
        });
        this._applyOrderingWindow();
    }

    /**
     * Replaces the locally derived cutoff with the server's, so a backend that
     * moves the cutoff (or blocks ordering entirely) is reflected here. A
     * failed call leaves the local BR-ORD-2 fallback in place.
     */
    private _applyOrderingWindow(): void {
        void this._orders
            .getOrderingWindow()
            .then((window) => {
                this.afterCutoff.set(!window.isOpen);
                const earliest = window.earliestServiceDate
                    ? DateTime.fromISO(window.earliestServiceDate).startOf(
                          'day'
                      )
                    : null;
                if (!earliest?.isValid) {
                    return;
                }
                this.minDeliveryDate.set(earliest);
                if (this.deliveryDate() < earliest) {
                    this.deliveryDate.set(earliest);
                }
            })
            .catch(() => {
                // Keep the local cutoff rule; the server still enforces its own.
            });
    }

    productName(product: CatalogProduct): string {
        return this.isVi() ? product.name : product.nameEn;
    }

    lineTotal(line: DraftOrderLine): number {
        return line.unitPrice * line.quantity;
    }

    onDeliveryDateChange(value: DateTime | null): void {
        if (!value || !value.isValid || value < this.minDeliveryDate()) {
            this.deliveryDate.set(this.minDeliveryDate());
            return;
        }
        this.deliveryDate.set(value.startOf('day'));
    }

    applyCoupon(): void {
        const code = this.couponCode().trim().toUpperCase();
        if (!code) {
            return;
        }
        // No coupon API yet — any code is rejected.
        this.appliedCoupon.set(null);
        this._snackBar.open(
            this._transloco.translate('cart.coupon.invalid'),
            undefined,
            { duration: 2500 }
        );
    }

    placeOrder(): void {
        if (!this.lines().length || this.submitting()) {
            return;
        }
        if (this.deliveryDate() < this.minDeliveryDate()) {
            this.deliveryDate.set(this.minDeliveryDate());
            this._snackBar.open(
                this._transloco.translate('checkout.shipping.dateInvalid'),
                undefined,
                { duration: 3000 }
            );
            return;
        }

        const items = this.lines().map((line) => ({
            marketProductId: line.product.marketProductId,
            quantity: line.quantity,
        }));
        const scheduledFor = this._scheduledFor();
        const notes = this.extraNote().trim() || undefined;

        this.submitting.set(true);
        this.blockers.set([]);
        void this._placeOrder(items, scheduledFor, notes).finally(() =>
            this.submitting.set(false)
        );
    }

    /**
     * Draft → preview → confirm. The preview asks the server whether the
     * approval / cutoff / credit gates pass *before* committing, so a refusal
     * arrives as a specific reason instead of a generic failure on confirm.
     * A blocked preview leaves the draft in place — the restaurant can fix the
     * cause and retry without rebuilding the cart.
     */
    private async _placeOrder(
        items: { marketProductId: string; quantity: number }[],
        scheduledFor: Date,
        notes: string | undefined
    ): Promise<void> {
        try {
            const orderId = await this._orders.createOrder(
                items,
                scheduledFor,
                notes
            );

            const preview = await this._orders
                .getConfirmPreview(orderId)
                // A preview that fails to load must not block a legal order —
                // the server still gates the confirm itself.
                .catch(() => null);
            if (preview && !preview.canConfirm) {
                this.blockers.set(
                    preview.blockers.length
                        ? preview.blockers
                        : [this._transloco.translate('checkout.blockedGeneric')]
                );
                return;
            }

            await this._orders.confirmOrder(orderId);
            this.placed.set(true);
            this._draftOrder.clear();
            this._snackBar.open(
                this._transloco.translate('cart.orderPlaced'),
                undefined,
                { duration: 3000 }
            );
        } catch (err) {
            // Keep the cart intact so the restaurant can retry.
            const message =
                (await apiErrorMessage(err)) ??
                this._transloco.translate('checkout.placeOrderError');
            this._snackBar.open(message, undefined, { duration: 6000 });
        }
    }

    /** Combines the selected delivery day with the chosen slot's start time. */
    private _scheduledFor(): Date {
        const slotStart = this.deliverySlot().split('-')[0] ?? '00:00';
        const [hour, minute] = slotStart.split(':').map(Number);
        return this.deliveryDate()
            .set({ hour, minute, second: 0, millisecond: 0 })
            .toJSDate();
    }

    trackByLine(_: number, line: DraftOrderLine): string {
        return line.product.id;
    }
}
