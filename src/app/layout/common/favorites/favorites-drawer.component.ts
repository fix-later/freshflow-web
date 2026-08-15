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
import { FavoritesService } from 'app/layout/common/favorites/favorites.service';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';

/**
 * Favorites side drawer, rendered at the layout root (not inside the header)
 * so the header's pin/slide animation and stacking context can't reposition
 * this fixed panel. Open-state comes from FavoritesService; the header
 * `<favorites>` trigger toggles the same signal.
 */
@Component({
    selector: 'favorites-drawer',
    templateUrl: './favorites-drawer.component.html',
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
    ],
})
export class FavoritesDrawerComponent {
    private readonly _translocoService = inject(TranslocoService);

    protected readonly favoritesService = inject(FavoritesService);
    private readonly _draftOrderService = inject(DraftOrderService);

    readonly items = this.favoritesService.items;
    readonly isOpen = this.favoritesService.drawerOpen;

    readonly isVi = computed(
        () => this._translocoService.getActiveLang() === 'vi'
    );

    productName(product: CatalogProduct): string {
        return this.isVi() ? product.name : product.nameEn;
    }

    productUnit(product: CatalogProduct): string {
        return this.isVi() ? product.unit : product.unitEn;
    }

    remove(marketProductId: string): void {
        void this.favoritesService.remove(marketProductId);
    }

    /**
     * Whether this favourite can still be ordered.
     *
     * Adding a line seeds one whole case (`DraftOrderService.add`), so anything
     * sold out, under a case, or with no case defined cannot be added at all —
     * the same rule the product tile applies, spelled here because a drawer row
     * is a second place to press the same button.
     */
    canAddToDraft(product: CatalogProduct): boolean {
        return (
            product.active !== false && this.unavailableLabel(product) === null
        );
    }

    /**
     * Why a favourite cannot be ordered, as an i18n key, or `null` when it can.
     *
     * Sold out and "down to less than one case" are told apart on the product
     * tile, where a shopper is choosing and the difference might change their
     * mind. Here it would not: the row is a saved item they cannot buy today,
     * and the case size is the platform's business rather than theirs — so both
     * read simply as **hết hàng**.
     */
    unavailableLabel(product: CatalogProduct): string | null {
        const pack = product.packWeightKg;
        const stock = product.quantity;
        const known = (value: number | null | undefined): value is number =>
            value !== null && value !== undefined;

        if (!known(pack) || pack <= 0) {
            // `FavoriteItemDto` carries no packing weight, so an absent one here
            // means "the favourites endpoint did not say", not "this product has
            // no packing code" — only the catalog listing can tell those apart.
            // Reporting it as unorderable marked every saved item unavailable.
            // Fall back to the one thing this row does state: whether any stock
            // is left.
            return known(stock) && stock <= 0 ? 'productCard.outOfStock' : null;
        }
        return known(stock) && stock < pack ? 'productCard.outOfStock' : null;
    }

    addToDraftOrder(product: CatalogProduct): void {
        // The control is absent in this state, but a favourite can sell out
        // while the drawer sits open.
        if (!this.canAddToDraft(product)) {
            return;
        }
        this._draftOrderService.add(product);
    }

    closeDrawer(): void {
        this.favoritesService.closeDrawer();
    }

    trackById(_: number, item: CatalogProduct): string {
        return item.id;
    }
}
