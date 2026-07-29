import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { FavoritesService } from 'app/layout/common/favorites/favorites.service';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';

@Component({
    selector: 'wishlist',
    templateUrl: './wishlist.component.html',
    styleUrls: ['./wishlist.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatSnackBarModule,
        MatTooltipModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class WishlistComponent implements OnInit {
    private readonly _favorites = inject(FavoritesService);
    private readonly _draftOrder = inject(DraftOrderService);
    private readonly _transloco = inject(TranslocoService);
    private readonly _snackBar = inject(MatSnackBar);

    readonly items = this._favorites.items;
    readonly count = this._favorites.count;

    ngOnInit(): void {
        // Deep-linkable route — ensure favorites are loaded even if the
        // header trigger never rendered first.
        void this._favorites.ensureLoaded();
    }

    readonly isVi = computed(() => this._transloco.getActiveLang() === 'vi');

    productName(product: CatalogProduct): string {
        return this.isVi() ? product.name : product.nameEn;
    }

    productUnit(product: CatalogProduct): string {
        return this.isVi() ? product.unit : product.unitEn;
    }

    remove(marketProductId: string): void {
        void this._favorites.remove(marketProductId);
    }

    addToDraftOrder(product: CatalogProduct): void {
        this._draftOrder.add(product);
        this._snackBar.open(
            this._transloco.translate('favorites.addedToDraft'),
            undefined,
            { duration: 2000 }
        );
    }

    trackById(_: number, item: CatalogProduct): string {
        return item.id;
    }
}
