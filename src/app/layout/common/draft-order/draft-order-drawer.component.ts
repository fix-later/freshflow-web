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
