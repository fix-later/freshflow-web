import { DecimalPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
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
import { CatalogProduct, PricePoint } from '../../catalog.types';

@Component({
    selector: 'product-detail',
    templateUrl: './product-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        DecimalPipe,
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

    /** Last 30 days of recorded prices for this market listing. */
    readonly priceHistory = signal<PricePoint[]>([]);

    /**
     * Low/high/latest over the loaded window, plus the change from the first
     * recorded point — the figures a buyer needs to judge whether today's
     * price is worth acting on. Null until at least two points exist.
     */
    readonly priceStats = computed(() => {
        const points = this.priceHistory();
        if (points.length < 2) {
            return null;
        }
        const prices = points.map((point) => point.price);
        const first = prices[0];
        const latest = prices[prices.length - 1];
        return {
            low: Math.min(...prices),
            high: Math.max(...prices),
            latest,
            changePct: first === 0 ? 0 : ((latest - first) / first) * 100,
        };
    });

    /** `polyline` points normalised into a 100×32 viewBox, oldest to newest. */
    readonly sparkline = computed(() => {
        const points = this.priceHistory();
        if (points.length < 2) {
            return '';
        }
        const prices = points.map((point) => point.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const span = max - min || 1;
        return prices
            .map((price, index) => {
                const x = (index / (prices.length - 1)) * 100;
                // SVG y grows downward, so a high price must sit near 0.
                const y = 32 - ((price - min) / span) * 32;
                return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(' ');
    });

    constructor() {
        // Re-fetch whenever the resolved listing changes (deep-link, or the
        // header switching market under the same product).
        effect(() => {
            const product = this.product();
            if (!product) {
                this.priceHistory.set([]);
                return;
            }
            const key = product.id;
            this.priceHistory.set([]);
            void this._catalogService
                .getPriceHistory(product.marketId, product.productId)
                .then((points) => {
                    // Drop a late response for a listing we've navigated away from.
                    if (this.product()?.id === key) {
                        this.priceHistory.set(points);
                    }
                });
        });
    }

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
