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
import { FuseCardComponent } from '@fuse/components/card';
import { TranslocoModule } from '@jsverse/transloco';
import { ProductCardVm } from './product-card.types';

/**
 * The single product tile for the storefront (home price board, catalog grid).
 *
 * Wraps `fuse-card` in flat mode: Fuse owns the shell, this component owns the
 * anatomy, so the tile is defined once instead of once per screen. Money and
 * metadata arrive pre-formatted on `ProductCardVm` — the tile holds no pricing
 * or ownership logic.
 */
@Component({
    selector: 'ff-product-card',
    templateUrl: './product-card.component.html',
    styleUrls: ['./product-card.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        FuseCardComponent,
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

    /** Five slots, filled up to `rating` — drives the star row. */
    stars(): boolean[] {
        const rating = Math.round(this.product.rating ?? 0);
        return Array.from({ length: 5 }, (_, i) => i < rating);
    }

    /** Both controls sit inside the tile's link — never navigate on click. */
    onFavorite(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this.favoriteToggled.emit(this.product);
    }

    onAddToCart(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this.addedToCart.emit(this.product);
    }
}
