import { DecimalPipe } from '@angular/common';
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
        // No coupon API yet — any code is rejected.
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

    trackByLine(_: number, line: DraftOrderLine): string {
        return line.product.id;
    }
}
