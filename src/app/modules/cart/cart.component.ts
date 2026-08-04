import { DecimalPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    computed,
    inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
        MatButtonModule,
        MatIconModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class CartComponent {
    private readonly _router = inject(Router);
    private readonly _draftOrder = inject(DraftOrderService);
    private readonly _transloco = inject(TranslocoService);

    readonly lines = this._draftOrder.lines;
    readonly subtotal = this._draftOrder.subtotal;

    /**
     * The backend prices an order as the sum of its line subtotals — no tax,
     * no delivery fee — and that is the figure charged to the restaurant's
     * credit (BR-CRE-1). The coupon box here never had an API behind it and
     * rejected every code, so it only promised a discount that could not
     * exist.
     */
    readonly total = computed(() => this.subtotal());

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
