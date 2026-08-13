import { NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { tagClass } from 'app/shared/tag-visual';
import { ProductCardVm } from './product-card.types';

/**
 * The single product tile for the storefront (home price board, catalog grid).
 *
 * Owns its whole shell — deliberately **not** built on `fuse-card`: the tile
 * needs a media block that bleeds to the card edge, an always-visible cart
 * action and stock state, none of which the generic Fuse card affords without
 * fighting its padding. Money and metadata arrive pre-formatted on
 * {@link ProductCardVm}; the tile holds no pricing or ownership logic.
 */
@Component({
    selector: 'ff-product-card',
    templateUrl: './product-card.component.html',
    styleUrls: ['./product-card.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatIconModule,
        MatTooltipModule,
        NgClass,
        RouterLink,
        TranslocoModule,
    ],
})
export class ProductCardComponent {
    @Input({ required: true }) product!: ProductCardVm;

    /** Hide on surfaces where favouriting makes no sense (e.g. the cart). */
    @Input() showFavorite = true;
    @Input() showAddToCart = true;

    @Output() favoriteToggled = new EventEmitter<ProductCardVm>();
    @Output() addedToCart = new EventEmitter<ProductCardVm>();

    /** Chip colour for a tag, keyed on its name so it is the same everywhere. */
    readonly tagClass = tagClass;

    /** Five slots, filled up to `rating` — drives the star row. */
    stars(): boolean[] {
        const rating = Math.round(this.product.rating ?? 0);
        return Array.from({ length: 5 }, (_, i) => i < rating);
    }

    /**
     * Only an explicit zero is "out of stock". A missing quantity means the
     * listing did not report one, which is not the same as none left.
     */
    isOutOfStock(): boolean {
        return this.product.stock === 0;
    }

    /** No packing code configured — there is no whole-case quantity to add. */
    hasNoPackingCode(): boolean {
        return !this.product.packWeightKg || this.product.packWeightKg <= 0;
    }

    /**
     * Stock exists but is under one whole case — just as unorderable as none,
     * since adding a fresh line always seeds one full case regardless of what
     * is on hand (`DraftOrderService.add`'s default quantity).
     */
    hasInsufficientStock(): boolean {
        const stock = this.product.stock;
        const pack = this.product.packWeightKg;
        if (stock === null || stock === undefined || !pack || pack <= 0) {
            return false;
        }
        return stock < pack;
    }

    canAddToCart(): boolean {
        return (
            !this.product.inactive &&
            !this.isOutOfStock() &&
            !this.hasNoPackingCode() &&
            !this.hasInsufficientStock()
        );
    }

    /** The favorite button sits over the thumb's link — never navigate. */
    onFavorite(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this.favoriteToggled.emit(this.product);
    }

    onAddToCart(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        if (!this.canAddToCart()) {
            return;
        }
        this.addedToCart.emit(this.product);
    }
}
