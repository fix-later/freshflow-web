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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ApprovalBannerComponent } from 'app/core/auth/components/approval-banner.component';
import { GuestGateService } from 'app/core/auth/guest-gate.service';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { formatRelativeTime } from 'app/core/util/relative-time';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { FavoritesService } from 'app/layout/common/favorites/favorites.service';
import { categoryVisual } from 'app/shared/product-card/category-visual';
import { ProductCardComponent } from 'app/shared/product-card/product-card.component';
import { ProductCardVm } from 'app/shared/product-card/product-card.types';
import { tagClass } from 'app/shared/tag-visual';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
    CATALOG_PAGE_SIZE,
    CatalogService,
    CategoryNode,
} from './catalog.service';
import {
    CatalogCategory,
    CatalogProduct,
    normalizeTagNames,
} from './catalog.types';

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
        MatCheckboxModule,
        MatExpansionModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
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
    private _guestGate = inject(GuestGateService);
    private _permissions = inject(PermissionsService);
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);

    readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

    private _sentinelObserver: IntersectionObserver | null = null;

    /**
     * Seeded from `?q=` so the storefront landing's hero search lands here
     * already filtered rather than dropping the buyer into the unfiltered grid.
     */
    readonly searchControl = new FormControl(
        this._route.snapshot.queryParamMap.get('q') ?? '',
        { nonNullable: true }
    );
    /**
     * Seeded from `?category=` so a link into the catalog (the header's mega
     * menu) lands already filtered, not on the unfiltered "all products" view.
     */
    readonly selectedCategory = signal<string>(
        this._route.snapshot.queryParamMap.get('category') ?? ''
    );
    readonly searchTerm = signal<string>(
        this._route.snapshot.queryParamMap.get('q') ?? ''
    );
    readonly sortOption = signal<SortOption>('');

    /**
     * "Hot deals" — the listings carrying a tag that pins to top.
     * Seeded from `?featured=1` so the header's Hot Deals menu, the footer link
     * and the mega-menu promo all land here already filtered.
     *
     * Kept as its own control rather than folded into {@link selectedTags}:
     * pinning is a meaning the platform defines (`Tag.PinsToTop`) rather than
     * one tag among many, every one of those inbound links spells it
     * `?featured=1`, and the offers panel is where a shopper looks for it.
     */
    readonly featuredOnly = signal<boolean>(
        this._route.snapshot.queryParamMap.get('featured') === '1'
    );

    /**
     * Market tags the shopper has ticked, seeded from `?tag=` (repeatable).
     * A listing must carry **every** selected tag — narrowing, like the rest of
     * this rail, so adding one never widens the result.
     */
    readonly selectedTags = signal<ReadonlySet<string>>(
        new Set(
            normalizeTagNames(this._route.snapshot.queryParamMap.getAll('tag'))
        )
    );

    /** Root categories the user has opened in the sidebar. */
    readonly expandedCategories = signal<ReadonlySet<string>>(new Set());
    /** Material accordion panels — categories + offers + tags start open. */
    categoriesExpanded = true;
    offersExpanded = true;
    tagsExpanded = true;
    /** Sidebar is a drawer below `lg`, where it would otherwise eat the fold. */
    readonly filtersOpen = signal(false);

    readonly skeletons = Array.from({ length: SKELETON_TILES }, (_, i) => i);

    /** Chip colour for a tag, keyed on its name so it is the same everywhere. */
    readonly tagClass = tagClass;

    readonly categories = this._catalogService.categories;
    readonly products = this._catalogService.products;

    /**
     * Guests browse the full catalogue but cannot order; the page says so once
     * at the top rather than only when a control refuses.
     */
    readonly isSignedIn = this._permissions.isSignedIn;

    /** The market being shopped — everything on this page is scoped to it. */
    readonly market = this._marketSelection.selected;
    readonly hasMarket = this._marketSelection.hasSelection;

    /** True while the market's listing is being read. */
    readonly loading = this._catalogService.loading;
    /**
     * True once `products()` holds the market's whole listing — which is when
     * the result count below stops being a running tally and becomes a total.
     */
    readonly listingComplete = this._catalogService.listingComplete;

    /**
     * How many of the matching products the grid has rendered.
     *
     * Infinite scroll is a **render** window, not paging: the whole listing is
     * already in memory (the endpoint can neither search, bound by price, sort
     * nor count — see `CatalogService`), so scrolling reveals more of an answer
     * that is already complete rather than fetching more of one that isn't.
     * That is what makes the count a total and keeps a price sort ordering the
     * market instead of the slice that happens to be on screen.
     */
    readonly visibleCount = signal(CATALOG_PAGE_SIZE);

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
     * Search, category, price, featured and sort, applied to the market's
     * **whole** listing — every one of them client-side, because the listing
     * endpoint takes none of them but `category` (and exact-matches a single id
     * there, so it cannot serve a parent). Running them all in one place is
     * what makes the count, the sort order and the empty state agree.
     */
    readonly filteredProducts = computed(() => {
        const search = this.searchTerm().trim().toLowerCase();
        const sort = this.sortOption();
        const scope = this.categoryScopeIds();
        let items = this.products();
        if (scope.size > 0) {
            items = items.filter((product) => scope.has(product.categoryId));
        }
        if (this.featuredOnly()) {
            items = items.filter((product) => product.featured);
        }
        const tags = this.selectedTags();
        if (tags.size > 0) {
            // Matched by name: `?tag=` carries names, and both sides are folded
            // the same way the server folds them.
            items = items.filter((product) => {
                const names = new Set(product.tags.map((tag) => tag.name));
                return [...tags].every((tag) => names.has(tag));
            });
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

    /**
     * The tag facet: every tag present in this market's listing, with how many
     * listings carry it, most-used first then alphabetical.
     *
     * Built from the whole listing rather than the current result set, so
     * ticking one tag does not make the others vanish from under the cursor.
     * Pinning tags are excluded — they already have their own control in the
     * offers panel ("Hot deals"), and offering them twice would let the two
     * disagree. Counted by name, because that is what `?tag=` carries.
     */
    readonly tagFacet = computed<{ tag: string; count: number }[]>(() => {
        const counts = new Map<string, number>();
        for (const product of this.products()) {
            for (const tag of product.tags) {
                if (!tag.pinsToTop && tag.name) {
                    counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1);
                }
            }
        }
        return [...counts.entries()]
            .map(([tag, count]) => ({ tag, count }))
            .sort(
                (a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'vi')
            );
    });

    /** The slice of the matches the grid has revealed so far. */
    readonly visibleProducts = computed(() =>
        this.filteredProducts().slice(0, this.visibleCount())
    );

    /** Total matches — every one of them, not just the rendered ones. */
    readonly resultCount = computed(() => this.filteredProducts().length);

    /** More matches exist than are rendered — reveal them on scroll. */
    readonly hasMore = computed(() => this.visibleCount() < this.resultCount());

    readonly hasActiveFilters = computed(
        () =>
            !!this.selectedCategory() ||
            !!this.searchTerm() ||
            this.featuredOnly() ||
            this.selectedTags().size > 0
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
        // The market is the only thing that changes *what* is listed — every
        // filter is applied client-side over the listing this reads, so none of
        // them belongs in this dependency list. Reading a market costs one
        // crawl, once per session; filtering it costs nothing.
        effect(() => {
            void this._catalogService.loadMarketListing(
                this._marketSelection.selectedId()
            );
        });

        // Any change to what matches restarts the reveal window at the top of
        // the new result set — otherwise narrowing a filter while deep in the
        // grid would leave a scrolled-past window over a much shorter list.
        effect(() => {
            this.searchTerm();
            this.selectedCategory();
            this.featuredOnly();
            this.selectedTags();
            this.sortOption();
            this._marketSelection.selectedId();
            this.visibleCount.set(CATALOG_PAGE_SIZE);
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

        // (The old "keep fetching until a filter matches something" effect is
        // gone with the paging it worked around. It could only ever find the
        // *first* match — a search that hit 30 rows still reported one — which
        // is exactly the class of bug reading the listing in full removes.)

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
                        this._renudgeSentinel();
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

        // The constructor only reads `?category=` / `?featured=` once, at
        // construction — Angular reuses this component across a
        // query-param-only navigation (e.g. picking a different category from
        // the header's mega menu, or Hot Deals while already on this page),
        // which fires no lifecycle hook a one-shot read would catch.
        // Subscribing keeps those links live for as long as the component does.
        this._route.queryParamMap
            .pipe(
                distinctUntilChanged(
                    (a, b) =>
                        a.get('category') === b.get('category') &&
                        a.get('featured') === b.get('featured') &&
                        a.get('q') === b.get('q') &&
                        a.getAll('tag').join(' ') === b.getAll('tag').join(' ')
                ),
                takeUntilDestroyed(this._destroyRef)
            )
            .subscribe((params) => {
                const category = params.get('category') ?? '';
                if (category !== this.selectedCategory()) {
                    this.selectedCategory.set(category);
                }
                const featured = params.get('featured') === '1';
                if (featured !== this.featuredOnly()) {
                    this.featuredOnly.set(featured);
                }
                const tags = normalizeTagNames(params.getAll('tag'));
                const current = this.selectedTags();
                if (
                    tags.length !== current.size ||
                    tags.some((tag) => !current.has(tag))
                ) {
                    this.selectedTags.set(new Set(tags));
                }
                const term = params.get('q') ?? '';
                if (term !== this.searchTerm()) {
                    this.searchTerm.set(term);
                    // `emitEvent: false` so seeding the box does not bounce
                    // back through the debounce and re-set what we just set.
                    this.searchControl.setValue(term, { emitEvent: false });
                }
            });
    }

    filterByCategory(categoryId: string): void {
        // No refetch: the listing is already in memory, so this only changes
        // which of it matches (and resets the reveal window, via the effect).
        this.selectedCategory.set(categoryId);
        this.filtersOpen.set(false);
        this._syncQueryParams({ category: categoryId });
    }

    toggleFeaturedOnly(): void {
        const next = !this.featuredOnly();
        this.featuredOnly.set(next);
        this._syncQueryParams({ featured: next ? '1' : '' });
    }

    isTagSelected(tag: string): boolean {
        return this.selectedTags().has(tag);
    }

    toggleTag(tag: string): void {
        const next = new Set(this.selectedTags());
        if (!next.delete(tag)) {
            next.add(tag);
        }
        this.selectedTags.set(next);
        this._syncQueryParams({ tag: [...next] });
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

    /** Guest notice CTA — opens the header's quick sign-in popup. */
    signIn(): void {
        this._guestGate.requireAccount();
    }

    setSort(option: SortOption): void {
        this.sortOption.set(option);
    }

    clearSearch(): void {
        this.searchControl.setValue('', { emitEvent: false });
        this.searchTerm.set('');
        // Also drop `?q=`, or a reload restores the term just cleared.
        this._syncQueryParams({ q: '' });
    }

    clearFilters(): void {
        this.searchControl.setValue('', { emitEvent: false });
        this.searchTerm.set('');
        this.selectedCategory.set('');
        this.featuredOnly.set(false);
        this.selectedTags.set(new Set());
        this._syncQueryParams({
            category: '',
            featured: '',
            q: '',
            tag: [],
        });
    }

    /**
     * Reveals the next screenful of matches — driven by the scroll sentinel,
     * and by the button beneath it for keyboard users. No request: the rows are
     * already loaded.
     */
    loadMore(): void {
        if (!this.hasMore()) {
            return;
        }
        this.visibleCount.update((count) => count + CATALOG_PAGE_SIZE);
    }

    /**
     * Re-arms the scroll sentinel after a reveal.
     *
     * Revealing is synchronous now, so one screenful of new tiles can leave the
     * sentinel still inside the observer's 400px margin — and an
     * IntersectionObserver reports threshold *crossings*, not standing state, so
     * it would never fire again and the grid would stall until the user
     * scrolled by hand. Re-observing once the new tiles are laid out produces a
     * fresh initial entry, which reveals again if the sentinel is still in view.
     */
    private _renudgeSentinel(): void {
        requestAnimationFrame(() => {
            const el = this.sentinel()?.nativeElement;
            if (!el || !this._sentinelObserver || !this.hasMore()) {
                return;
            }
            this._sentinelObserver.unobserve(el);
            this._sentinelObserver.observe(el);
        });
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

    /**
     * The tile stops the click reaching its own link before emitting.
     *
     * Guests get the sign-in popup rather than a silent 401 — favourites are
     * stored per account, so there is nothing to toggle without one.
     */
    toggleFavorite(product: CatalogProduct): void {
        if (!this._guestGate.requireAccount()) {
            return;
        }
        void this._favoritesService.toggle(product);
    }

    /** Same draft-order entry point the wishlist uses (`WishlistComponent`). */
    addToDraftOrder(product: CatalogProduct): void {
        if (!this._guestGate.requireAccount()) {
            return;
        }
        this._draftOrder.add(product);
    }

    /**
     * Map a listing onto the shared tile's view model.
     *
     * The listing row carries more than a name and a price — category, selling
     * unit, packing weight, available vs. on-hand quantity, featured flag and
     * when the market last restated it — and all of it bears on whether to buy.
     * The tile shows the lot rather than making the shopper open the product to
     * find out how it is sold or how old the price is.
     */
    productVm(product: CatalogProduct): ProductCardVm {
        const category =
            this.categoryName(product.categoryId) || product.categoryLabel;
        // Short form here: this is a denominator and a stock suffix, where
        // "Kilogram" would wrap the price line.
        const unit =
            product.unitShort || (this.isVi() ? product.unit : product.unitEn);
        // Photos live on the base product, which `GET /products` gates behind a
        // signed-in role — so a guest's whole grid arrives with no `thumbnail`.
        // The category stand-in keeps that from reading as a broken page, and
        // covers a signed-in user's un-photographed products for free.
        const fallback = categoryVisual(category);
        return {
            id: product.id,
            name: this.productName(product),
            description: this.productDescription(product),
            thumbnail: product.thumbnail,
            emoji: fallback.emoji,
            thumbTint: fallback.thumbTint,
            price: this.formatPrice(product.price),
            priceUnit: unit || undefined,
            eyebrow: category || undefined,
            // Market only — the unit moved to the price denominator, where it
            // says something the shopper can act on.
            meta: product.marketSource || undefined,
            packNote: this.packNote(product),
            updatedNote: this.updatedNote(product),
            badge: product.featured
                ? this._translocoService.translate('productCard.featured')
                : undefined,
            badgeClass: product.featured
                ? 'ff-product-card__badge--featured'
                : undefined,
            // Pinning tags are the badge above; listing them again here would
            // put the same claim on the tile twice.
            tags: product.tags
                .filter((tag) => !tag.pinsToTop)
                .map((tag) => tag.name),
            stock: product.quantity,
            stockUnit: unit || undefined,
            favorite: this.isFavorite(product),
            inactive: product.active === false,
            link: product.productId,
        };
    }

    /**
     * "Kiện 15 kg" — how the goods are packed, from the listing's selling unit.
     * Undefined for a product sold loose (no packing code, so no capacity).
     */
    packNote(product: CatalogProduct): string | undefined {
        const weight = product.packWeightKg;
        if (weight === null || weight <= 0) {
            return undefined;
        }
        return this._translocoService.translate('productCard.packWeight', {
            weight: weight.toLocaleString(
                this._translocoService.getActiveLang()
            ),
        });
    }

    /** "2 giờ trước" — how long ago this market last restated price/quantity. */
    updatedNote(product: CatalogProduct): string | undefined {
        return (
            formatRelativeTime(
                product.updatedAt,
                this._translocoService.getActiveLang()
            ) ?? undefined
        );
    }

    /**
     * Keeps `?category=` / `?featured=` in step with in-page filtering, so the
     * URL a click on the sidebar leaves behind is the same one that lands here
     * filtered from the header's Hot Deals menu — shareable and
     * back/forward-safe either way. An empty value drops the parameter.
     */
    private _syncQueryParams(params: Record<string, string | string[]>): void {
        const queryParams: Record<string, string | string[] | null> = {};
        for (const [key, value] of Object.entries(params)) {
            // An empty value — or an empty list — drops the parameter, so a
            // cleared filter leaves no `?tag=` behind to be re-read on reload.
            queryParams[key] = Array.isArray(value)
                ? value.length
                    ? value
                    : null
                : value || null;
        }
        void this._router.navigate([], {
            relativeTo: this._route,
            queryParams,
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }
}
