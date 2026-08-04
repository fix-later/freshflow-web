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
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ApprovalBannerComponent } from 'app/core/auth/components/approval-banner.component';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { FavoritesService } from 'app/layout/common/favorites/favorites.service';
import { ProductCardComponent } from 'app/shared/product-card/product-card.component';
import { ProductCardVm } from 'app/shared/product-card/product-card.types';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CatalogService, CategoryNode } from './catalog.service';
import { CatalogCategory, CatalogProduct } from './catalog.types';

type SortOption = '' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';

/** Placeholder tiles rendered while the first page is in flight. */
const SKELETON_TILES = 10;

@Component({
    selector: 'catalog',
    templateUrl: './catalog.component.html',
    styleUrls: ['./catalog.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
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
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);

    readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

    private _sentinelObserver: IntersectionObserver | null = null;

    readonly searchControl = new FormControl('', { nonNullable: true });
    /**
     * Seeded from `?category=` so a link into the catalog (the header's mega
     * menu) lands already filtered, not on the unfiltered "all products" view.
     */
    readonly selectedCategory = signal<string>(
        this._route.snapshot.queryParamMap.get('category') ?? ''
    );
    readonly searchTerm = signal<string>('');
    readonly sortOption = signal<SortOption>('');

    /** Root categories the user has opened in the sidebar. */
    readonly expandedCategories = signal<ReadonlySet<string>>(new Set());
    /** Sidebar is a drawer below `lg`, where it would otherwise eat the fold. */
    readonly filtersOpen = signal(false);

    readonly skeletons = Array.from({ length: SKELETON_TILES }, (_, i) => i);

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

    /** Sidebar tree — same shape the header's mega menu renders. */
    readonly categoryTree = this._catalogService.categoryTree;

    /** Selected category plus its parent, for the breadcrumb and page title. */
    readonly selectedTrail = computed<CatalogCategory[]>(() => {
        const id = this.selectedCategory();
        if (!id) {
            return [];
        }
        const all = this.categories();
        const current = all.find((cat) => cat.id === id);
        if (!current) {
            return [];
        }
        const parent = current.parentId
            ? all.find((cat) => cat.id === current.parentId)
            : undefined;
        return parent ? [parent, current] : [current];
    });

    /**
     * Category ids that match the current sidebar selection. A leaf is just
     * itself; a parent includes its children so products assigned to a leaf
     * still show when the parent row is clicked (the listing API exact-matches
     * a single id and would otherwise return an empty page).
     */
    readonly categoryScopeIds = computed<ReadonlySet<string>>(() => {
        const id = this.selectedCategory();
        if (!id) {
            return new Set();
        }
        const node = this.categoryTree().find((n) => n.id === id);
        if (!node?.children.length) {
            return new Set([id]);
        }
        return new Set([id, ...node.children.map((child) => child.id)]);
    });

    /**
     * Search, category, and sort run over the pages loaded so far. Category is
     * also sent to the listing endpoint for leaf filters; parent filters stay
     * client-side because the API does not expand descendants.
     */
    readonly filteredProducts = computed(() => {
        const search = this.searchTerm().trim().toLowerCase();
        const sort = this.sortOption();
        const scope = this.categoryScopeIds();
        let items = this.products();
        if (scope.size > 0) {
            items = items.filter((product) => scope.has(product.categoryId));
        }
        if (search) {
            items = items.filter(
                (product) =>
                    product.name.toLowerCase().includes(search) ||
                    product.nameEn.toLowerCase().includes(search)
            );
        }
        if (sort === 'name-asc' || sort === 'name-desc') {
            const direction = sort === 'name-asc' ? 1 : -1;
            items = [...items].sort(
                (a, b) =>
                    direction *
                    this.productName(a).localeCompare(this.productName(b), 'vi')
            );
        } else if (sort === 'price-asc' || sort === 'price-desc') {
            const direction = sort === 'price-asc' ? 1 : -1;
            // Unpriced listings sort last either way — they carry no position
            // on a price axis, and floating them to the top would read as free.
            items = [...items].sort((a, b) => {
                if (a.price === null || b.price === null) {
                    return a.price === b.price ? 0 : a.price === null ? 1 : -1;
                }
                return direction * (a.price - b.price);
            });
        }
        return items;
    });

    /** Everything loaded so far, after the client-side filters above. */
    readonly visibleProducts = this.filteredProducts;

    readonly resultCount = computed(() => this.filteredProducts().length);

    readonly hasActiveFilters = computed(
        () => !!this.selectedCategory() || !!this.searchTerm()
    );

    /** True only before the first page has produced anything to show. */
    readonly showSkeletons = computed(
        () => this.loading() && this.products().length === 0
    );

    readonly sortOptions: readonly { value: SortOption; label: string }[] = [
        { value: '', label: 'catalog.sort.default' },
        { value: 'name-asc', label: 'catalog.sort.nameAsc' },
        { value: 'name-desc', label: 'catalog.sort.nameDesc' },
        { value: 'price-asc', label: 'catalog.sort.priceAsc' },
        { value: 'price-desc', label: 'catalog.sort.priceDesc' },
    ];

    constructor() {
        // Market and category are server-side query parameters: changing either
        // starts a new listing from the first page rather than filtering rows
        // that are already on screen. Parent categories with children are not
        // sent to the API (exact-match would empty the page); those stay
        // client-scoped via `categoryScopeIds`.
        effect(() => {
            const marketId = this._marketSelection.selectedId();
            const category = this.selectedCategory();
            const node = category
                ? this.categoryTree().find((n) => n.id === category)
                : undefined;
            const serverCategory =
                category && !node?.children.length ? category : undefined;
            void this._catalogService.loadFirstPage(marketId, serverCategory);
        });

        // Keep the branch holding the selection open — categories arrive after
        // the first render, so this cannot be decided once at construction.
        effect(() => {
            const parent = this.selectedTrail()[0];
            if (!parent) {
                return;
            }
            this.expandedCategories.update((open) =>
                open.has(parent.id) ? open : new Set([...open, parent.id])
            );
        });

        // When a parent (or search) filter hides the whole first page, keep
        // pulling until something matches or the listing is exhausted — otherwise
        // the grid looks empty and the filter appears broken.
        effect(() => {
            if (
                !this.hasActiveFilters() ||
                this.loading() ||
                !this.hasMore() ||
                this.visibleProducts().length > 0
            ) {
                return;
            }
            this.loadMore();
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

        // The constructor only reads `?category=` once, at construction —
        // Angular reuses this component across a query-param-only navigation
        // (e.g. picking a different category from the header's mega menu
        // while already on this page), which fires no lifecycle hook a
        // one-shot read would catch. Subscribing keeps that link live for as
        // long as the component does.
        this._route.queryParamMap
            .pipe(
                distinctUntilChanged(
                    (a, b) => a.get('category') === b.get('category')
                ),
                takeUntilDestroyed(this._destroyRef)
            )
            .subscribe((params) => {
                const next = params.get('category') ?? '';
                if (next !== this.selectedCategory()) {
                    this.selectedCategory.set(next);
                }
            });
    }

    filterByCategory(categoryId: string): void {
        // The effect in the constructor reloads page 1 for the new category.
        this.selectedCategory.set(categoryId);
        this.filtersOpen.set(false);
        this._syncCategoryQueryParam(categoryId);
    }

    toggleCategory(categoryId: string): void {
        this.expandedCategories.update((open) => {
            const next = new Set(open);
            if (!next.delete(categoryId)) {
                next.add(categoryId);
            }
            return next;
        });
    }

    isExpanded(categoryId: string): boolean {
        return this.expandedCategories().has(categoryId);
    }

    /** A root counts as selected when the selection is one of its children. */
    isBranchSelected(node: CategoryNode): boolean {
        const selected = this.selectedCategory();
        return (
            node.id === selected ||
            node.children.some((child) => child.id === selected)
        );
    }

    toggleFilters(): void {
        this.filtersOpen.update((open) => !open);
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
        this._syncCategoryQueryParam('');
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
        return this.categoryLabel(cat);
    }

    categoryLabel(category: CatalogCategory): string {
        return this.isVi() ? category.name : category.nameEn;
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
            eyebrow: this.categoryName(product.categoryId),
            meta: `${this.isVi() ? product.unit : product.unitEn} · ${product.marketSource}`,
            stock: product.quantity,
            stockUnit: this.isVi() ? product.unit : product.unitEn,
            favorite: this.isFavorite(product),
            inactive: product.active === false,
            link: product.productId,
        };
    }

    /**
     * Keeps `?category=` in step with in-page filtering, so the URL a click
     * on the sidebar leaves behind is the same one that lands here filtered
     * from the header's mega menu — shareable and back/forward-safe either way.
     */
    private _syncCategoryQueryParam(categoryId: string): void {
        void this._router.navigate([], {
            relativeTo: this._route,
            queryParams: { category: categoryId || null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }
}
