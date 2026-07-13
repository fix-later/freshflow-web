import { DecimalPipe, NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DEMO_INTEREST_PRODUCTS } from 'app/layout/common/draft-order/draft-order.demo-data';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { DraftOrderLine } from 'app/layout/common/draft-order/draft-order.types';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';

@Component({
    selector: 'cart',
    templateUrl: './cart.component.html',
    styleUrls: ['./cart.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        DecimalPipe,
        NgClass,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSnackBarModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class CartComponent {
    private readonly _router = inject(Router);
    private readonly _draftOrder = inject(DraftOrderService);
    private readonly _transloco = inject(TranslocoService);
    private readonly _snackBar = inject(MatSnackBar);

    readonly lines = this._draftOrder.lines;
    readonly subtotal = this._draftOrder.subtotal;

    readonly couponCode = signal('');
    readonly appliedCoupon = signal<string | null>(null);
    readonly interestIndex = signal(0);

    readonly interestProducts = DEMO_INTEREST_PRODUCTS;

    readonly discount = computed(() => {
        if (!this.appliedCoupon()) {
            return 0;
        }
        return Math.round(this.subtotal() * 0.1);
    });

    readonly total = computed(() =>
        Math.max(0, this.subtotal() - this.discount())
    );

    readonly isVi = computed(() => this._transloco.getActiveLang() === 'vi');

    readonly visibleInterests = computed(() => {
        const start = this.interestIndex();
        const items = this.interestProducts;
        return [0, 1, 2].map(
            (offset) => items[(start + offset) % items.length]
        );
    });

    productName(product: CatalogProduct): string {
        return this.isVi() ? product.name : product.nameEn;
    }

    productUnit(product: CatalogProduct): string {
        return this.isVi() ? product.unit : product.unitEn;
    }

    lineTotal(line: DraftOrderLine): number {
        return line.unitPrice * line.quantity;
    }

    increment(line: DraftOrderLine): void {
        this._draftOrder.setQuantity(line.product.id, line.quantity + 1);
    }

    decrement(line: DraftOrderLine): void {
        this._draftOrder.setQuantity(line.product.id, line.quantity - 1);
    }

    remove(productId: string): void {
        this._draftOrder.remove(productId);
    }

    applyCoupon(): void {
        const code = this.couponCode().trim().toUpperCase();
        if (!code) {
            return;
        }
        if (code === 'FRESH10' || code === 'GIAM10') {
            this.appliedCoupon.set(code);
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

    proceedToCheckout(): void {
        if (!this.lines().length) {
            return;
        }
        void this._router.navigateByUrl('/checkout');
    }

    addInterest(item: (typeof DEMO_INTEREST_PRODUCTS)[number]): void {
        this._draftOrder.add(item.product, 1, item.unitPrice);
        this._snackBar.open(
            this._transloco.translate('cart.interest.added'),
            undefined,
            { duration: 2000 }
        );
    }

    nextInterests(): void {
        this.interestIndex.update(
            (i) => (i + 1) % this.interestProducts.length
        );
    }

    prevInterests(): void {
        this.interestIndex.update(
            (i) =>
                (i - 1 + this.interestProducts.length) %
                this.interestProducts.length
        );
    }

    setInterestPage(index: number): void {
        this.interestIndex.set(index);
    }

    stars(rating: number): boolean[] {
        return [1, 2, 3, 4, 5].map((i) => i <= Math.round(rating));
    }

    trackByLine(_: number, line: DraftOrderLine): string {
        return line.product.id;
    }
}
