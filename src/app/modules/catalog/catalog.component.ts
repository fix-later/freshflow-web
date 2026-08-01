import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ApprovalBannerComponent } from 'app/core/auth/components/approval-banner.component';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { FavoritesService } from 'app/layout/common/favorites/favorites.service';
import { ProductCardComponent } from 'app/shared/product-card/product-card.component';
import { ProductCardVm } from 'app/shared/product-card/product-card.types';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CatalogService } from './catalog.service';
import { CatalogProduct } from './catalog.types';

type SortOption = '' | 'name-asc' | 'name-desc';

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
        MatProgressSpinnerModule,
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
    private _marketSelection = inject(MarketSelectionService);

    readonly resultsSection =
        viewChild<ElementRef<HTMLElement>>('resultsSection');
    readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

    private _sentinelObserver: IntersectionObserver | null = null;

    readonly searchControl = new FormControl('', { nonNullable: true });
    readonly selectedCategory = signal<string>('');
    readonly searchTerm = signal<string>('');
    readonly sortOption = signal<SortOption>('');

    readonly categories = this._catalogService.categories;
    readonly products = this._catalogService.products;

    /** The market being shopped — everything on this page is scoped to it. */
    readonly market = this._marketSelection.selected;
    readonly hasMarket = this._marketSelection.hasSelection;

    /** Paging state comes from the service: one server page per screenful. */
    readonly loading = this._catalogService.loading;
    readonly hasMore = this._catalogService.hasMore;

    readonly isVi = computed(
        () => this._translocoService.getActiveLang() === 'vi'
    );

    /**
     * Search and sort run over the pages loaded so far, not the whole market.
     * The listing endpoint offers neither a query nor a sort parameter, so
     * anything past the last loaded page cannot be matched until it is fetched.
     */
    readonly filteredProducts = computed(() => {
        const search = this.searchTerm().trim().toLowerCase();
        const sort = this.sortOption();
        let items = this.products();
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

    /** Everything loaded so far, after the client-side filters above. */
    readonly visibleProducts = this.filteredProducts;

    readonly resultCount = computed(() => this.filteredProducts().length);

    readonly hasActiveFilters = computed(
        () => !!this.selectedCategory() || !!this.searchTerm()
    );

    constructor() {
        // Market and category are server-side query parameters: changing either
        // starts a new listing from the first page rather than filtering rows
        // that are already on screen.
        effect(() => {
            const marketId = this._marketSelection.selectedId();
            const category = this.selectedCategory();
            void this._catalogService.loadFirstPage(
                marketId,
                category || undefined
            );
        });

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
        void this._marketSelection.ensureLoaded();
        this.searchControl.valueChanges
            .pipe(
                debounceTime(150),
                distinctUntilChanged(),
                takeUntilDestroyed(this._destroyRef)
            )
            .subscribe((search) => this.searchTerm.set(search));
    }

    filterByCategory(categoryId: string): void {
        // The effect in the constructor reloads page 1 for the new category.
        this.selectedCategory.set(categoryId);
        this._scrollToResults();
    }

    setSort(option: SortOption): void {
        this.sortOption.set(option);
    }

    clearSearch(): void {
        this.searchControl.setValue('', { emitEvent: false });
        this.searchTerm.set('');
    }

    clearFilters(): void {
        this.searchControl.setValue('', { emitEvent: false });
        this.searchTerm.set('');
        this.selectedCategory.set('');
    }

    /** Fetches the next server page — driven by the scroll sentinel. */
    loadMore(): void {
        void this._catalogService.loadNextPage();
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

    private _scrollToResults(): void {
        this.resultsSection()?.nativeElement.scrollIntoView({ block: 'start' });
    }
}
