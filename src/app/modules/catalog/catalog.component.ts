import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    inject,
    OnInit,
    signal,
    viewChild,
    ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ApprovalBannerComponent } from 'app/core/auth/components/approval-banner.component';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { FavoritesService } from 'app/layout/common/favorites/favorites.service';
import { ProductCardComponent } from 'app/shared/product-card/product-card.component';
import { ProductCardVm } from 'app/shared/product-card/product-card.types';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CatalogService } from './catalog.service';
import { CatalogProduct } from './catalog.types';

type SortOption = '' | 'name-asc' | 'name-desc';

const DEFAULT_BATCH_SIZE = 12;

@Component({
    selector: 'catalog',
    templateUrl: './catalog.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatChipsModule,
        MatButtonModule,
        MatRadioModule,
        MatSelectModule,
        MatTooltipModule,
        ReactiveFormsModule,
        RouterLink,
        TranslocoModule,
        ApprovalBannerComponent,
        ProductCardComponent,
    ],
})
export class CatalogComponent implements OnInit {
    private _catalogService = inject(CatalogService);
    private _translocoService = inject(TranslocoService);
    private _destroyRef = inject(DestroyRef);
    private _favoritesService = inject(FavoritesService);
    private _draftOrder = inject(DraftOrderService);

    readonly resultsSection =
        viewChild<ElementRef<HTMLElement>>('resultsSection');
    readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

    private _sentinelObserver: IntersectionObserver | null = null;

    readonly searchControl = new FormControl('', { nonNullable: true });
    readonly selectedCategory = signal<string>('');
    readonly searchTerm = signal<string>('');
    readonly lastLoadedCount = signal(0);

    /** How many matching products are currently revealed (infinite-scroll cursor). */
    readonly visibleCount = signal(DEFAULT_BATCH_SIZE);
    readonly batchSize = signal(DEFAULT_BATCH_SIZE);

    readonly selectedMarket = signal<string>('');
    readonly sortOption = signal<SortOption>('');

    readonly categories = this._catalogService.categories;
    readonly products = this._catalogService.products;

    readonly isVi = computed(
        () => this._translocoService.getActiveLang() === 'vi'
    );

    /** Distinct market sources across the full (already fully-loaded) catalog. */
    readonly marketSources = computed(() => [
        ...new Set(
            this.products()
                .map((product) => product.marketSource)
                .filter(Boolean)
        ),
    ]);

    /** Full catalog after category/market/search filters + sort — everything is
     *  already loaded, so this is a pure client-side computation. */
    readonly filteredProducts = computed(() => {
        const category = this.selectedCategory();
        const market = this.selectedMarket();
        const search = this.searchTerm().trim().toLowerCase();
        const sort = this.sortOption();
        let items = this.products();
        if (category) {
            items = items.filter((product) => product.categoryId === category);
        }
        if (market) {
            items = items.filter((product) => product.marketSource === market);
        }
        if (search) {
            items = items.filter(
                (product) =>
                    product.name.toLowerCase().includes(search) ||
                    product.nameEn.toLowerCase().includes(search)
            );
        }
        if (sort) {
            const direction = sort === 'name-asc' ? 1 : -1;
            items = [...items].sort(
                (a, b) =>
                    direction *
                    this.productName(a).localeCompare(this.productName(b), 'vi')
            );
        }
        return items;
    });

    /** The slice of `filteredProducts()` revealed so far. */
    readonly visibleProducts = computed(() =>
        this.filteredProducts().slice(0, this.visibleCount())
    );

    readonly resultCount = computed(() => this.filteredProducts().length);

    readonly hasActiveFilters = computed(
        () =>
            !!this.selectedCategory() ||
            !!this.searchTerm() ||
            !!this.selectedMarket()
    );

    readonly hasMore = computed(
        () => this.visibleCount() < this.filteredProducts().length
    );

    constructor() {
        // The sentinel <div> is unconditionally rendered (see template), so
        // it already exists in the DOM by the first post-construction render.
        afterNextRender(() => {
            const el = this.sentinel()?.nativeElement;
            if (!el) {
                return;
            }
            this._sentinelObserver = new IntersectionObserver(
                (entries) => {
                    if (entries.some((entry) => entry.isIntersecting)) {
                        this.loadMore();
                    }
                },
                { rootMargin: '400px' }
            );
            this._sentinelObserver.observe(el);
            this._destroyRef.onDestroy(() =>
                this._sentinelObserver?.disconnect()
            );
        });
    }

    ngOnInit(): void {
        void this._favoritesService.ensureLoaded();
        this.searchControl.valueChanges
            .pipe(
                debounceTime(150),
                distinctUntilChanged(),
                takeUntilDestroyed(this._destroyRef)
            )
            .subscribe((search) => {
                this.searchTerm.set(search);
                this._resetReveal();
            });
    }

    filterByCategory(categoryId: string): void {
        this.selectedCategory.set(categoryId);
        this.selectedMarket.set('');
        this._resetReveal();
    }

    filterByMarket(source: string): void {
        this.selectedMarket.set(source);
        this._resetReveal();
    }

    setSort(option: SortOption): void {
        this.sortOption.set(option);
        this._resetReveal();
    }

    setPageSize(size: number): void {
        this.batchSize.set(size);
        this.visibleCount.set(size);
    }

    clearSearch(): void {
        this.searchControl.setValue('', { emitEvent: false });
        this.searchTerm.set('');
        this._resetReveal();
    }

    clearFilters(): void {
        this.searchControl.setValue('', { emitEvent: false });
        this.searchTerm.set('');
        this.selectedCategory.set('');
        this.selectedMarket.set('');
        this._resetReveal();
    }

    /** Reveals the next batch of already-loaded products. */
    loadMore(): void {
        if (!this.hasMore()) {
            return;
        }
        const revealed = Math.min(
            this.visibleCount() + this.batchSize(),
            this.filteredProducts().length
        );
        this.lastLoadedCount.set(revealed - this.visibleCount());
        this.visibleCount.set(revealed);
    }

    categoryName(categoryId: string): string {
        const cat = this.categories().find((c) => c.id === categoryId);
        if (!cat) {
            return '';
        }
        return this.isVi() ? cat.name : cat.nameEn;
    }

    productName(product: CatalogProduct): string {
        return this.isVi() ? product.name : product.nameEn;
    }

    productDescription(product: CatalogProduct): string {
        return this.isVi() ? product.description : product.descriptionEn;
    }

    formatPrice(price: number | null): string {
        if (price === null) {
            return '—';
        }
        return `${price.toLocaleString(this._translocoService.getActiveLang())} ₫`;
    }

    isFavorite(product: CatalogProduct): boolean {
        return this._favoritesService.isFavorite(product.marketProductId);
    }

    /** The tile stops the click reaching its own link before emitting. */
    toggleFavorite(product: CatalogProduct): void {
        void this._favoritesService.toggle(product);
    }

    /** Same draft-order entry point the wishlist uses (`WishlistComponent`). */
    addToDraftOrder(product: CatalogProduct): void {
        this._draftOrder.add(product);
    }

    /** Map a listing onto the shared tile's view model. */
    productVm(product: CatalogProduct): ProductCardVm {
        return {
            id: product.id,
            name: this.productName(product),
            description: this.productDescription(product),
            thumbnail: product.thumbnail,
            price: this.formatPrice(product.price),
            meta: `${this.isVi() ? product.unit : product.unitEn} · ${product.marketSource}`,
            favorite: this.isFavorite(product),
            inactive: product.active === false,
            link: product.productId,
        };
    }

    private _resetReveal(): void {
        this.visibleCount.set(this.batchSize());
        this.resultsSection()?.nativeElement.scrollIntoView({ block: 'start' });
    }
}
