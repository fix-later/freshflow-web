import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { FavoritesService } from 'app/layout/common/favorites/favorites.service';
import { CatalogService } from '../../catalog.service';
import { CatalogProduct } from '../../catalog.types';

@Component({
    selector: 'product-detail',
    templateUrl: './product-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class ProductDetailComponent implements OnInit {
    private _catalogService = inject(CatalogService);
    private _translocoService = inject(TranslocoService);
    private _favoritesService = inject(FavoritesService);

    readonly product = this._catalogService.product;
    readonly categories = this._catalogService.categories;

    readonly selectedIndex = signal(0);
    readonly descriptionExpanded = signal(true);

    readonly isVi = computed(
        () => this._translocoService.getActiveLang() === 'vi'
    );

    /** Gallery images, falling back to the thumbnail when no images[] are set. */
    readonly galleryImages = computed<string[]>(() => {
        const product = this.product();
        if (!product) {
            return [];
        }
        return product.images?.length ? product.images : [product.thumbnail];
    });

    readonly mainImage = computed<string>(() => {
        const images = this.galleryImages();
        return images[this.selectedIndex()] ?? images[0] ?? '';
    });

    ngOnInit(): void {
        // Deep-linkable route — ensure favorites are loaded even if the
        // header trigger never rendered first.
        void this._favoritesService.ensureLoaded();
    }

    selectImage(index: number): void {
        this.selectedIndex.set(index);
    }

    isFavorite(product: CatalogProduct): boolean {
        return this._favoritesService.isFavorite(product.marketProductId);
    }

    toggleFavorite(product: CatalogProduct): void {
        void this._favoritesService.toggle(product);
    }

    toggleDescription(): void {
        this.descriptionExpanded.update((expanded) => !expanded);
    }

    categoryName(categoryId: string): string {
        const cat = this.categories().find((c) => c.id === categoryId);
        if (!cat) {
            return '';
        }
        return this.isVi() ? cat.name : cat.nameEn;
    }

    formatPrice(price: number | null): string {
        if (price === null) {
            return '—';
        }
        return `${price.toLocaleString(this._translocoService.getActiveLang())} ₫`;
    }
}
