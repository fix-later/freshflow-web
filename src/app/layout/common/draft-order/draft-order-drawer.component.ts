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
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { FuseDrawerComponent } from '@fuse/components/drawer';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { DraftOrderLine } from 'app/layout/common/draft-order/draft-order.types';
import {
    canDecrease,
    canIncrease,
    caseCount,
    packSize,
} from 'app/modules/cart/cart-line-rules';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';

/**
 * Draft-order side drawer at the layout root (PRD M5 · FR-ORD). Uses a dimmed
 * overlay so the rest of the page is blocked while open. Footer CTAs navigate
 * to the full cart page.
 */
@Component({
    selector: 'draft-order-drawer',
    templateUrl: './draft-order-drawer.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        FuseDrawerComponent,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        RouterLink,
        TranslocoModule,
        DecimalPipe,
    ],
})
export class DraftOrderDrawerComponent {
    private readonly _translocoService = inject(TranslocoService);

    protected readonly draftOrderService = inject(DraftOrderService);

    readonly lines = this.draftOrderService.lines;
    readonly count = this.draftOrderService.productCount;
    readonly isOpen = this.draftOrderService.drawerOpen;
    readonly subtotal = this.draftOrderService.subtotal;

    readonly isVi = computed(
        () => this._translocoService.getActiveLang() === 'vi'
    );

    productName(product: CatalogProduct): string {
        return this.isVi() ? product.name : product.nameEn;
    }

    productUnit(product: CatalogProduct): string {
        return this.isVi() ? product.unit : product.unitEn;
    }

    /**
     * The short unit, for sitting beside a number.
     *
     * Falls back to kilograms rather than to nothing. A line restored from the
     * server is rebuilt from the order item, which carries no unit at all
     * (`DraftOrderService._degradedProduct`), and that left the row reading
     * "10.000₫ /" with the denominator missing. Kilograms is not a guess: cart
     * quantity *is* kg — the service says so, and the stepper moves by a whole
     * case of them.
     */
    unitShort(product: CatalogProduct): string {
        return product.unitShort || this.productUnit(product) || 'kg';
    }

    /**
     * The quantity as whole cases, matching the cart page. The kilograms are
     * what get sent; see {@link caseCount}.
     */
    readonly caseCount = caseCount;

    /** "kiện" when there is a case to count in, else the product's own unit. */
    caseUnit(line: DraftOrderLine): string {
        const weight = line.product.packWeightKg;
        return weight !== null && weight !== undefined && weight > 0
            ? this._translocoService.translate('cart.caseUnit')
            : this.unitShort(line.product);
    }

    /**
     * "30 kg mỗi kiện" — what one of the cases counted above actually weighs.
     * Without it the row states a price per kilo and a quantity in cases with
     * nothing connecting them, and the total cannot be checked. Null for a line
     * with no case size, where the quantity is already in kilograms.
     */
    packLabel(line: DraftOrderLine): string | null {
        const weight = line.product.packWeightKg;
        if (weight === null || weight === undefined || weight <= 0) {
            return null;
        }
        return this._translocoService.translate('productCard.packWeight', {
            weight: weight.toLocaleString(
                this._translocoService.getActiveLang()
            ),
        });
    }

    /**
     * What this line costs at the quantity now on it. Shown because a price per
     * kilo beside a quantity leaves the buyer doing the multiplication — the
     * cart page has always shown this, and the drawer is the same cart.
     */
    lineTotal(line: DraftOrderLine): number {
        return line.unitPrice * line.quantity;
    }

    /** Stepper bounds — the same per-line rules the cart page enforces (see cart-line-rules). */
    readonly canIncrease = canIncrease;
    readonly canDecrease = canDecrease;

    increment(line: DraftOrderLine): void {
        if (!canIncrease(line)) {
            return;
        }
        this.draftOrderService.setQuantity(
            line.product.id,
            line.quantity + packSize(line)
        );
    }

    decrement(line: DraftOrderLine): void {
        if (!canDecrease(line)) {
            return;
        }
        this.draftOrderService.setQuantity(
            line.product.id,
            line.quantity - packSize(line)
        );
    }

    remove(productId: string): void {
        this.draftOrderService.remove(productId);
    }

    closeDrawer(): void {
        this.draftOrderService.closeDrawer();
    }

    trackById(_: number, line: DraftOrderLine): string {
        return line.product.id;
    }
}
