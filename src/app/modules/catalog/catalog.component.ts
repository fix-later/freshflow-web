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
import { CatalogCategory, CatalogProduct } from './catalog.types';

type SortOption = '' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';

/** A root category with the children the API reports beneath it. */
interface CategoryNode extends CatalogCategory {
    children: CatalogCategory[];
}

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

    readonly resultsSection =
        viewChild<ElementRef<HTMLElement>>('resultsSection');
    readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

    private _sentinelObserver: IntersectionObserver | null = null;

    readonly searchControl = new FormControl('', { nonNullable: true });
    readonly selectedCategory = signal<string>('');
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

    /**
     * Sidebar tree. A category whose `parentId` names a category the API did
     * not return is treated as a root rather than dropped — an unresolvable
     * parent must not make its children unreachable.
     */
    readonly categoryTree = computed<CategoryNode[]>(() => {
        const all = this.categories();
        const ids = new Set(all.map((cat) => cat.id));
        const childrenOf = new Map<string, CatalogCategory[]>();
        for (const cat of all) {
            if (!cat.parentId || !ids.has(cat.parentId)) {
                continue;
            }
            const siblings = childrenOf.get(cat.parentId) ?? [];
            siblings.push(cat);
            childrenOf.set(cat.parentId, siblings);
        }
        return all
            .filter((cat) => !cat.parentId || !ids.has(cat.parentId))
            .map((cat) => ({ ...cat, children: childrenOf.get(cat.id) ?? [] }));
    });

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
        // that are already on screen.
        effect(() => {
            const marketId = this._marketSelection.selectedId();
            const category = this.selectedCategory();
            void this._catalogService.loadFirstPage(
                marketId,
                category || undefined
            );
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
        this.filtersOpen.set(false);
        this._scrollToResults();
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

    private _scrollToResults(): void {
        this.resultsSection()?.nativeElement.scrollIntoView({ block: 'start' });
    }
}
