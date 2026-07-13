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
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { DraftOrderLine } from 'app/layout/common/draft-order/draft-order.types';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
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

    readonly lines = this._draftOrder.lines;
    readonly subtotal = this._draftOrder.subtotal;

    readonly placed = signal(false);
    readonly voucherOpen = signal(false);
    readonly couponCode = signal('');
    readonly appliedCoupon = signal<string | null>(null);
    readonly freshQualityNote = signal(true);
    readonly extraNote = signal('');

    /** Earliest day the restaurant may pick (respects 22:00 cutoff). */
    readonly minDeliveryDate = toLuxonDay(earliestDeliveryDate());

    readonly deliveryDate = signal<DateTime>(this.minDeliveryDate);
    readonly deliverySlot = signal('09:00-11:00');

    readonly afterCutoff = new Date().getHours() >= CUTOFF_HOUR;

    readonly deliverySlots = [
        '06:00-08:00',
        '09:00-11:00',
        '14:00-16:00',
        '16:00-18:00',
    ] as const;

    readonly demoAddress =
        'PASSION COFFEE, (Nhà Văn hóa Sinh viên TP.HCM) Số 1 Lưu Hữu Phước, Thành phố Hồ Chí Minh, Phường Đông Hòa, Thành phố Hồ Chí Minh';

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

    /** Demo strikethrough: show a slightly higher “list” total when discounted. */
    readonly listTotal = computed(() =>
        this.discount() > 0 ? this.total() + this.discount() : null
    );

    readonly isVi = computed(() => this._transloco.getActiveLang() === 'vi');

    ngOnInit(): void {
        if (!this.lines().length && !this.placed()) {
            void this._router.navigateByUrl('/cart');
        }
    }

    productName(product: CatalogProduct): string {
        return this.isVi() ? product.name : product.nameEn;
    }

    lineTotal(line: DraftOrderLine): number {
        return line.unitPrice * line.quantity;
    }

    onDeliveryDateChange(value: DateTime | null): void {
        if (!value || !value.isValid || value < this.minDeliveryDate) {
            this.deliveryDate.set(this.minDeliveryDate);
            return;
        }
        this.deliveryDate.set(value.startOf('day'));
    }

    applyCoupon(): void {
        const code = this.couponCode().trim().toUpperCase();
        if (!code) {
            return;
        }
        if (code === 'FRESH10' || code === 'GIAM10') {
            this.appliedCoupon.set(code);
            this.voucherOpen.set(false);
            this._snackBar.open(
                this._transloco.translate('cart.coupon.applied'),
                undefined,
                { duration: 2500 }
            );
            return;
        }
        this.appliedCoupon.set(null);
        this._snackBar.open(
            this._transloco.translate('cart.coupon.invalid'),
            undefined,
            { duration: 2500 }
        );
    }

    placeOrder(): void {
        if (!this.lines().length) {
            return;
        }
        if (this.deliveryDate() < this.minDeliveryDate) {
            this.deliveryDate.set(this.minDeliveryDate);
            this._snackBar.open(
                this._transloco.translate('checkout.shipping.dateInvalid'),
                undefined,
                { duration: 3000 }
            );
            return;
        }
        this.placed.set(true);
        this._draftOrder.clear();
        this._snackBar.open(
            this._transloco.translate('cart.orderPlaced'),
            undefined,
            { duration: 3000 }
        );
    }

    trackByLine(_: number, line: DraftOrderLine): string {
        return line.product.id;
    }
}
