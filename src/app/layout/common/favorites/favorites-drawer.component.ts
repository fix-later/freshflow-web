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

    addToDraftOrder(product: CatalogProduct): void {
        this._draftOrderService.add(product);
    }

    closeDrawer(): void {
        this.favoritesService.closeDrawer();
    }

    trackById(_: number, item: CatalogProduct): string {
        return item.id;
    }
}
