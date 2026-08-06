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
import { canDecrease, canIncrease, cartLineIssues } from './cart-line-rules';

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
     * The draft this cart is: its id, how it stands with the server, and why
     * the last write failed. Shown because the cart is no longer a local list —
     * "saved" is the difference between closing the tab and losing the order,
     * and the buyer has no other way to tell.
     */
    readonly draftId = this._draftOrder.orderId;
    readonly syncState = this._draftOrder.syncState;
    readonly syncError = this._draftOrder.syncError;

    /** Short id for display — the full UUID says nothing to a buyer. */
    readonly draftLabel = computed(() => this.draftId()?.slice(0, 8) ?? '');

    /** Re-reads the draft after a failed write, so the cart shows the truth. */
    retrySync(): void {
        void this._draftOrder.restore();
    }

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

    /** Stepper bounds — the server's own per-line rules (see cart-line-rules). */
    readonly canIncrease = canIncrease;
    readonly canDecrease = canDecrease;

    /**
     * The reasons this line would be refused, localized. Empty for a line the
     * stepper has kept inside its bounds; non-empty for one restored from
     * storage after the listing's stock or minimum moved.
     */
    lineIssues(line: DraftOrderLine): string[] {
        return cartLineIssues(line, this.productName(line.product)).map(
            (issue) => this._transloco.translate(issue.key, issue.params)
        );
    }

    /** True when at least one line would be refused at confirm. */
    readonly hasBlockedLine = computed(() =>
        this.lines().some((line) => cartLineIssues(line, '').length > 0)
    );

    increment(line: DraftOrderLine): void {
        if (!canIncrease(line)) {
            return;
        }
        this._draftOrder.setQuantity(line.product.id, line.quantity + 1);
    }

    decrement(line: DraftOrderLine): void {
        // Stops at the product's minimum instead of stepping into a quantity
        // the confirm would reject — or, at 1, deleting the line outright.
        if (!canDecrease(line)) {
            return;
        }
        this._draftOrder.setQuantity(line.product.id, line.quantity - 1);
    }

    remove(productId: string): void {
        this._draftOrder.remove(productId);
    }

    proceedToCheckout(): void {
        if (!this.lines().length || this.hasBlockedLine()) {
            return;
        }
        void this._router.navigateByUrl('/checkout');
    }

    trackByLine(_: number, line: DraftOrderLine): string {
        return line.product.id;
    }
}
