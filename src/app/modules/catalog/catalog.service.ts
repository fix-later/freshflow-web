import { computed, inject, Injectable, signal } from '@angular/core';
import {
    extractList,
    extractNextCursor,
    fetchAllOffset,
    MAX_PAGE_SIZE,
    parseJson,
} from 'app/core/api/envelope';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { categoriesApi, marketsApi, productsApi } from 'contract';
import { from, Observable, tap } from 'rxjs';
import {
    CatalogCategory,
    CatalogProduct,
    CatalogTag,
    normalizeTagNames,
} from './catalog.types';

/** A root category with the children the API reports beneath it. */
export interface CategoryNode extends CatalogCategory {
    children: CatalogCategory[];
}

/**
 * Listings revealed per step of the catalog's infinite scroll.
 *
 * A **render** window, not a request size: the whole market listing is fetched
 * up front (see {@link CatalogService.loadMarketListing}), and the grid reveals
 * it a screenful at a time so the DOM does not carry thousands of tiles at once.
 */
export const CATALOG_PAGE_SIZE = 20;

/**
 * Rows per request while crawling a market's listing — the largest the backend
 * accepts, so the crawl costs ⌈rows / 100⌉ requests rather than one per
 * screenful.
 */
const LISTING_FETCH_PAGE_SIZE = MAX_PAGE_SIZE;

/**
 * Safety cap on the crawl below. At {@link LISTING_FETCH_PAGE_SIZE} rows a page
 * this is 20k listings — far beyond any single market — and stops a backend
 * that keeps handing back a cursor from looping forever.
 */
const MAX_LISTING_PAGES = 200;

/**
 * Page size used when harvesting a market's featured listings.
 *
 * The listing endpoint pins **every** featured row to the top of page 1
 * regardless of page size (`MarketProductReader.GetPageAsync`), so one small
 * request returns the complete featured set; this only bounds the ordinary
 * rows that ride along behind them.
 */
const FEATURED_PROBE_PAGE_SIZE = 5;

/**
 * Catalog data access — backed by the generated, typed OpenAPI client
 * (`typescript-fetch`) instead of a handwritten `HttpClient` call.
 *
 * **Scoped to the selected market.** Price and availability are per-market, so
 * the catalog lists `GET /markets/{marketId}/products` for the market chosen in
 * the header (`MarketSelectionService`) — not an aggregate across every market.
 *
 * **The market's listing is read in full, once per market.** That endpoint is
 * cursor-paginated and reports **no total**, and it filters on nothing but
 * `category` — no search, no price bounds, no sort. Filtering page-by-page as
 * the user scrolls therefore cannot answer "how many match": a search would
 * only see the rows already fetched, a price sort would re-order a slice rather
 * than the market, and the result count would climb with every scroll instead
 * of naming a total. So the catalog crawls every page up front
 * ({@link LISTING_FETCH_PAGE_SIZE} rows a request) and caches the result per
 * market; search, price, category, featured, sort, count and the infinite
 * scroll then all run over the complete set and agree with each other.
 *
 * The trade is explicit: ⌈rows / 100⌉ requests when a market is first opened,
 * and that market's listing held in memory for the session. Move the filters
 * (and a `totalCount`) onto the endpoint if a market ever grows past what that
 * can carry.
 *
 * Each listing row is joined back to its base product for the fields the market
 * row does not carry (description, unit, images, i18n names). The base product
 * list is fetched once per session and cached, so paging costs one request per
 * screenful.
 *
 * Note: the backend's OpenAPI spec does not yet declare response schemas for
 * its GET endpoints (they are documented only as "200 OK"), so bodies are
 * parsed defensively via the shared envelope helpers rather than typed
 * response models.
 */
interface RawRow {
    [key: string]: unknown;
}

/** Notified with the rows read so far after each page of a listing crawl. */
type ProgressFn = (rows: CatalogProduct[]) => void;

/** The outcome of crawling one market's listing. */
interface MarketListing {
    products: CatalogProduct[];
    /**
     * False when the crawl stopped early (a failed request, or the page cap),
     * which makes `products` a prefix of the listing rather than all of it —
     * so nothing derived from it may be presented as a total.
     */
    complete: boolean;
}

/** First numeric value among `keys` on `row`, parsing numeric strings too. */
function num(row: RawRow, keys: string[]): number | null {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === 'number' && !Number.isNaN(value)) {
            return value;
        }
        if (
            typeof value === 'string' &&
            value.trim() !== '' &&
            !Number.isNaN(+value)
        ) {
            return +value;
        }
    }
    return null;
}

/** First non-empty string value among `keys` on `row`. */
function str(row: RawRow, keys: string[]): string {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === 'string' && value.trim() !== '') {
            return value;
        }
    }
    return '';
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
    private _marketSelection = inject(MarketSelectionService);

    private _categories = signal<CatalogCategory[]>([]);
    private _categoriesLoading = signal(false);
    private _products = signal<CatalogProduct[]>([]);
    private _product = signal<CatalogProduct | null>(null);
    private _loading = signal(false);
    private _listingComplete = signal(false);

    /** Market whose listing is being shown, so a stale crawl cannot overwrite it. */
    private _requestKey = '';
    private _baseProducts: Promise<Map<string, RawRow>> | null = null;
    /**
     * Cached category fetch. Both the catalog page (sidebar tree) and the
     * header (mega menu) call {@link getCategories}, and without this they'd
     * each fire their own `GET /categories` for the same session-lifetime data.
     */
    private _categoriesPromise: Promise<CatalogCategory[]> | null = null;
    /** Featured listings per market id — see {@link getFeaturedProducts}. */
    private _featuredByMarket = new Map<string, Promise<CatalogProduct[]>>();
    /**
     * Complete listing per market, crawled once and replayed after that.
     * Holds the in-flight promise too, so two callers asking at the same time
     * (the grid and a deep-linked product page) share one crawl.
     */
    private _listingByMarket = new Map<string, Promise<MarketListing>>();
    /** Per-market progress listeners for the crawl above. */
    private _listingProgress = new Map<string, Set<ProgressFn>>();

    readonly categories = this._categories.asReadonly();
    /** True while the first (uncached) category fetch of the session is in flight. */
    readonly categoriesLoading = this._categoriesLoading.asReadonly();
    /**
     * The selected market's listings. Complete once {@link listingComplete} is
     * true; before that it holds the pages the crawl has landed so far, so the
     * grid fills as they arrive instead of waiting behind a blank screen.
     */
    readonly products = this._products.asReadonly();
    readonly product = this._product.asReadonly();
    /** True while the market's listing is being crawled. */
    readonly loading = this._loading.asReadonly();
    /**
     * True once {@link products} holds the market's **whole** listing. Any
     * total shown to the user is only honest from this point — before it, the
     * count is of what has landed, not of what matches.
     */
    readonly listingComplete = this._listingComplete.asReadonly();

    /**
     * Categories arranged into a two-level tree (root categories with their
     * direct children), the shape both the catalog sidebar and the header's
     * mega menu render. A category whose `parentId` names a category the API
     * did not return is treated as a root rather than dropped — an
     * unresolvable parent must not make its children unreachable.
     */
    readonly categoryTree = computed<CategoryNode[]>(() => {
        const all = this._categories();
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

    /**
     * Fetches once per session and caches; every later call (catalog page,
     * header mega menu) replays the same result instead of re-fetching.
     *
     * An empty result is not cached: `_loadCategories` swallows its own
     * failures into `[]` rather than rejecting, and a guest 401 looks
     * identical to "no categories exist" from here. Not caching it means the
     * first call after signing in (or once categories actually exist) tries
     * again instead of replaying a stale empty list for the rest of the tab.
     */
    getCategories(): Observable<CatalogCategory[]> {
        if (!this._categoriesPromise) {
            this._categoriesLoading.set(true);
            this._categoriesPromise = this._loadCategories().then(
                (categories) => {
                    this._categoriesLoading.set(false);
                    if (categories.length === 0) {
                        this._categoriesPromise = null;
                    }
                    return categories;
                }
            );
        }
        return from(this._categoriesPromise).pipe(
            tap((categories) => this._categories.set(categories))
        );
    }

    /**
     * How many catalogue products sit in each category, keyed by category id.
     *
     * Costs **no** request: {@link _loadBaseProducts} already walks the whole
     * product list once per session (market listing rows carry no description,
     * unit or images, so the base products are fetched regardless), and this is
     * a reduction over that cached map.
     *
     * Counts the **catalogue**, not the selected market's listings — the market
     * listing endpoint is cursor-paginated and reports no total, so a
     * per-market count is not obtainable without walking every page. Callers
     * must label the number accordingly.
     */
    async categoryCounts(): Promise<ReadonlyMap<string, number>> {
        const counts = new Map<string, number>();
        const baseById = await this._loadBaseProducts();
        for (const row of baseById.values()) {
            const categoryId = str(row, ['categoryId']);
            if (!categoryId) {
                continue;
            }
            counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
        }
        return counts;
    }

    /**
     * The market's featured listings — the rows carrying a tag whose
     * `pinsToTop` is set, which the header's Hot Deals menu groups by category.
     *
     * Deliberately separate from the paged `products` signal: the menu is
     * global chrome and must not disturb (or be disturbed by) whatever page
     * the catalog grid is currently showing.
     *
     * Cached per market for the session. An empty result is not cached — a
     * guest 401 is swallowed into `[]` here and looks identical to "this
     * market pinned nothing", so the next open retries instead of replaying
     * an empty menu for the rest of the tab.
     */
    getFeaturedProducts(marketId: string): Promise<CatalogProduct[]> {
        const cached = this._featuredByMarket.get(marketId);
        if (cached) {
            return cached;
        }
        const pending = this._loadFeatured(marketId).then((products) => {
            if (products.length === 0) {
                this._featuredByMarket.delete(marketId);
            }
            return products;
        });
        this._featuredByMarket.set(marketId, pending);
        return pending;
    }

    /**
     * Reads `marketId`'s **whole** listing into {@link products}, replacing
     * whatever was there. Call on entry and whenever the market changes.
     *
     * Filters are deliberately *not* parameters: the endpoint cannot apply
     * them (see the class docs), so the catalog filters the complete set
     * client-side rather than refetching per filter — which also means changing
     * a filter costs no request.
     */
    async loadMarketListing(marketId: string | null): Promise<void> {
        this._requestKey = marketId ?? '';
        this._products.set([]);

        if (!marketId) {
            // No market chosen yet — the catalog shows its "pick a market"
            // state rather than an arbitrary market's products. Nothing is
            // pending, so the (empty) listing is already complete.
            this._listingComplete.set(true);
            return;
        }

        this._listingComplete.set(false);
        this._loading.set(true);
        try {
            const listing = await this._getMarketListing(marketId, (soFar) => {
                if (this._requestKey === marketId) {
                    this._products.set(soFar);
                }
            });
            if (this._requestKey !== marketId) {
                return;
            }
            this._products.set(listing.products);
            this._listingComplete.set(listing.complete);
        } finally {
            if (this._requestKey === marketId) {
                this._loading.set(false);
            }
        }
    }

    /**
     * The market's listing for a surface that wants to *read* it without owning
     * the page's copy — the header search, which must not blank the catalog
     * grid behind it.
     *
     * Deliberately not {@link loadMarketListing}: that one clears `products`
     * and raises `loading` because it is the catalog page taking possession of
     * the signal. This shares the same per-market crawl (so it costs nothing
     * once the grid has loaded, and joins the in-flight one otherwise) and
     * writes no signals at all.
     */
    async peekMarketListing(marketId: string): Promise<CatalogProduct[]> {
        return (await this._getMarketListing(marketId)).products;
    }

    getProductById(productId: string): Observable<CatalogProduct> {
        return from(this._resolveProduct(productId)).pipe(
            tap((product) => this._product.set(product))
        );
    }

    // Price history is deliberately NOT read here. It is an operational record
    // of what a market agent set and when — it belongs to product configuration
    // in Admin (`CatalogAdminService.getPriceHistory`, Admin ▸ Markets ▸
    // Pricing ▸ History), not to the buyer-facing listing.

    /**
     * A market's complete listing, crawled at most once and replayed after
     * that. `onProgress` (optional) receives the rows landed so far after every
     * page, so a caller can render the listing as it fills; it is called on the
     * shared crawl, so a second caller joining mid-crawl still sees progress.
     *
     * Only a **complete, non-empty** crawl is cached. A partial one would be
     * replayed as though it were the whole listing — the count would then name
     * a total that is short, and a product past the failure point would look
     * like one this market does not carry. An empty one is dropped for the same
     * reason as in {@link getFeaturedProducts}: a guest 401 is swallowed into
     * `[]` here and is indistinguishable from a market with no listings.
     */
    private _getMarketListing(
        marketId: string,
        onProgress?: ProgressFn
    ): Promise<MarketListing> {
        if (onProgress) {
            const listeners =
                this._listingProgress.get(marketId) ?? new Set<ProgressFn>();
            listeners.add(onProgress);
            this._listingProgress.set(marketId, listeners);
        }

        let pending = this._listingByMarket.get(marketId);
        if (!pending) {
            pending = this._crawlMarketListing(marketId).then((listing) => {
                if (!listing.complete || listing.products.length === 0) {
                    this._listingByMarket.delete(marketId);
                }
                return listing;
            });
            this._listingByMarket.set(marketId, pending);
        }

        return pending.finally(() => {
            if (!onProgress) {
                return;
            }
            const listeners = this._listingProgress.get(marketId);
            listeners?.delete(onProgress);
            if (listeners && listeners.size === 0) {
                this._listingProgress.delete(marketId);
            }
        });
    }

    /**
     * Walks every page of `GET /markets/{id}/products` and maps the rows.
     *
     * Stops on a missing, repeated or short-page cursor — the same three
     * conditions the paged reader used — and at {@link MAX_LISTING_PAGES} as a
     * backstop. A failure mid-crawl resolves with the pages already read rather
     * than rejecting (a partial catalog is worth more to a shopper than an empty
     * one) but reports `complete: false`, which is what stops those rows being
     * counted as a total or cached as the whole listing.
     *
     * Rows are de-duplicated by listing id. The backend pins featured rows to
     * page 1 *and* excludes them from the keyset stream, so it should not repeat
     * anything — but over a whole crawl a single overlap would show a duplicate
     * tile and inflate the total, which is the one number this exists to get
     * right.
     */
    private async _crawlMarketListing(
        marketId: string
    ): Promise<MarketListing> {
        const market = this._marketSelection.selected() ?? {
            id: marketId,
            name: '',
        };
        const all: CatalogProduct[] = [];
        const seenProducts = new Set<string>();
        const seenCursors = new Set<string>();
        let cursor: string | undefined;
        let complete = false;

        try {
            const baseById = await this._loadBaseProducts();

            for (let page = 0; page < MAX_LISTING_PAGES; page++) {
                const res = await marketsApi.apiV1MarketsMarketIdProductsGetRaw(
                    { marketId, cursor, pageSize: LISTING_FETCH_PAGE_SIZE }
                );
                const body = await parseJson(res.raw);
                const rows = extractList<RawRow>(body);

                for (const row of rows) {
                    const product = this._toCatalogProduct(
                        row,
                        market,
                        baseById
                    );
                    if (product && !seenProducts.has(product.id)) {
                        seenProducts.add(product.id);
                        all.push(product);
                    }
                }
                this._emitListingProgress(marketId, all);

                const next = extractNextCursor(body);
                if (
                    !next ||
                    seenCursors.has(next) ||
                    rows.length < LISTING_FETCH_PAGE_SIZE
                ) {
                    complete = true;
                    break;
                }
                seenCursors.add(next);
                cursor = next;
            }
        } catch {
            // Keep what landed, flagged incomplete — see the doc comment above.
        }

        return { products: all, complete };
    }

    /** Hands the rows read so far to whoever is watching this market's crawl. */
    private _emitListingProgress(
        marketId: string,
        rows: CatalogProduct[]
    ): void {
        const listeners = this._listingProgress.get(marketId);
        if (!listeners?.size) {
            return;
        }
        const snapshot = [...rows];
        for (const listener of listeners) {
            listener(snapshot);
        }
    }

    /**
     * Reads page 1 of the market's listing and keeps only the pinned rows.
     * Failures resolve to an empty list — a menu that cannot load must not
     * break the header it lives in.
     */
    private async _loadFeatured(marketId: string): Promise<CatalogProduct[]> {
        const page = await this._fetchMarketPage(
            marketId,
            FEATURED_PROBE_PAGE_SIZE
        );
        return page.filter((product) => product.featured);
    }

    /**
     * One page of a market's listings, mapped but **not** stored in
     * {@link products}.
     *
     * Deliberately separate from {@link loadMarketListing}: surfaces outside
     * the catalog grid (the header's deals menu, the storefront landing) need a
     * bounded slice of the listing without disturbing the grid — and without
     * paying for the full crawl the grid does. Failures resolve to an empty
     * list rather than rejecting, because
     * every one of those surfaces has an empty state and none of them should be
     * able to break the page they sit on.
     */
    private async _fetchMarketPage(
        marketId: string,
        pageSize: number
    ): Promise<CatalogProduct[]> {
        try {
            const res = await marketsApi.apiV1MarketsMarketIdProductsGetRaw({
                marketId,
                pageSize,
            });
            const rows = extractList<RawRow>(await parseJson(res.raw));
            const market = this._marketSelection.selected() ?? {
                id: marketId,
                name: '',
            };
            const baseById = await this._loadBaseProducts();
            return rows
                .map((row) => this._toCatalogProduct(row, market, baseById))
                .filter((product): product is CatalogProduct => !!product);
        } catch {
            return [];
        }
    }

    private async _loadCategories(): Promise<CatalogCategory[]> {
        try {
            const res = await categoriesApi.apiV1CategoriesGetRaw({
                activeOnly: true,
            });
            const rows = extractList<RawRow>(await parseJson(res.raw));
            return rows
                .map((row) => this._toCategory(row))
                .filter((category): category is CatalogCategory => !!category);
        } catch {
            return [];
        }
    }

    private _toCategory(row: RawRow): CatalogCategory | null {
        const id = str(row, ['id', 'categoryId']);
        if (!id) {
            return null;
        }
        const name = str(row, ['name', 'categoryName']);
        const parentRaw = str(row, ['parentId', 'parentCategoryId']);
        return {
            id,
            name,
            nameEn: str(row, ['nameEn']) || name,
            slug: str(row, ['slug']),
            icon: str(row, ['icon']),
            imageUrl: str(row, ['imageUrl', 'image']),
            parentId: parentRaw || null,
        };
    }

    /**
     * The base product catalogue, indexed by id and fetched at most once per
     * session. Market listings carry price and quantity but not the product's
     * description, unit, images or English names — those live here.
     */
    private _loadBaseProducts(): Promise<Map<string, RawRow>> {
        this._baseProducts ??= fetchAllOffset<RawRow>((page, pageSize) =>
            productsApi
                .apiV1ProductsGetRaw({ includeInactive: false, page, pageSize })
                .then((res) => res.raw)
        )
            .then(
                (rows) =>
                    new Map(
                        rows.map((row) => [str(row, ['id', 'productId']), row])
                    )
            )
            .catch(() => {
                // Let the next page retry instead of caching the failure.
                this._baseProducts = null;
                return new Map<string, RawRow>();
            });
        return this._baseProducts;
    }

    private _toCatalogProduct(
        row: RawRow,
        market: { id: string; name: string },
        baseById: Map<string, RawRow>
    ): CatalogProduct | null {
        const productId = str(row, ['productId', 'id']);
        if (!productId) {
            return null;
        }
        const base = baseById.get(productId) ?? {};
        const images = Array.isArray(base['images'])
            ? (base['images'] as unknown[]).filter(
                  (v): v is string => typeof v === 'string'
              )
            : [];
        const imageUrl =
            str(row, ['imageUrl', 'thumbnail', 'image']) ||
            str(base, ['thumbnail', 'imageUrl']) ||
            images[0] ||
            '';
        const thumbnail = imageUrl;
        const name = str(row, ['productName']) || str(base, ['name']);
        if (!name) {
            return null;
        }
        const description = str(base, ['description']);
        // The market-product row's own id — distinct from the base productId
        // above. Not documented in the spec (the GET response has no declared
        // schema), but favorites/analytics key on this as `marketProductId`,
        // so capture it defensively; falls back to the composite id if the
        // row genuinely has no separate identifier.
        const marketProductId =
            str(row, ['marketProductId', 'id']) || `${productId}:${market.id}`;

        // Listing payload now sends the category *name* (`category`), not an
        // id. Keep the label for the tile and resolve an id against the tree
        // when we can so sidebar filters still match.
        const categoryLabel = str(row, ['category']);
        let categoryId = str(row, ['categoryId']) || str(base, ['categoryId']);
        if (!categoryId && categoryLabel) {
            const match = this._categories().find(
                (cat) =>
                    cat.name === categoryLabel || cat.nameEn === categoryLabel
            );
            categoryId = match?.id ?? '';
        }

        const sellingUnit =
            row['sellingUnit'] && typeof row['sellingUnit'] === 'object'
                ? (row['sellingUnit'] as RawRow)
                : null;
        const unitFromSelling = sellingUnit
            ? str(sellingUnit, ['unitName', 'name'])
            : '';
        const unit =
            str(row, ['unit']) ||
            unitFromSelling ||
            str(base, ['unitName', 'unit']) ||
            '';
        const unitEn =
            str(base, ['unitAbbreviation', 'unitEn']) ||
            unitFromSelling ||
            unit;
        // "kg" rather than "Kilogram" wherever the full name would crowd the
        // layout. Only the abbreviation qualifies — `unitEn` falls back to the
        // full name, which would defeat the point.
        const unitShort = str(base, ['unitAbbreviation']) || unit;
        // `weightKg` on the listing's `sellingUnit`; the base product spells the
        // same figure `capacityKg`.
        const packWeightKg = sellingUnit
            ? num(sellingUnit, ['weightKg', 'capacityKg'])
            : num(base, ['capacityKg']);
        const tags = this._readTags(row);

        return {
            id: `${productId}:${market.id}`,
            productId,
            marketProductId,
            name,
            nameEn: str(base, ['nameEn']) || name,
            description,
            descriptionEn: str(base, ['descriptionEn']) || description,
            categoryId,
            categoryLabel,
            unit,
            unitEn,
            unitShort,
            marketId: str(row, ['marketId']) || market.id,
            marketSource: market.name,
            price: num(row, ['currentPrice', 'price', 'unitPrice']),
            // `availableQuantity` first, deliberately: it is on-hand minus
            // reserved, i.e. what this buyer can still order. Falling back to
            // `currentQuantity` would promise stock other orders already hold.
            quantity: num(row, [
                'availableQuantity',
                'currentQuantity',
                'quantity',
            ]),
            totalQuantity: num(row, ['currentQuantity', 'quantity']),
            packWeightKg,
            updatedAt: str(row, ['updatedAt', 'modifiedAt']),
            // Lives on the product, not the market listing, so it is read from
            // `base`. A missing or nonsensical value means "no minimum", which
            // is what the backend's own default of 1 amounts to.
            minimumOrderQuantity: Math.max(
                1,
                num(base, ['minimumOrderQuantity']) ?? 1
            ),
            thumbnail,
            imageUrl,
            images: images.length ? images : imageUrl ? [imageUrl] : [],
            active: base['active'] !== false,
            tags,
            featured: tags.some((tag) => tag.pinsToTop),
        };
    }

    /**
     * The listing's tags, read across every shape this API has served.
     *
     * Three generations exist and a deployment can be on any of them:
     *  - `isFeatured: boolean` (original),
     *  - `tags: string[]` of free-form names, one of which meant "pinned"
     *    (SCRUM-385),
     *  - `tags: [{ id, name, pinsToTop }]` referencing the tag catalog
     *    (SCRUM-386, current).
     *
     * All three are read because none of these failures announces itself — the
     * grid simply stops pinning anything and the tag facet empties, with no
     * error anywhere. A bare string is kept as a name-only tag so it can still
     * be displayed and filtered; it just cannot claim to pin, since only the
     * catalog knows that.
     */
    private _readTags(row: RawRow): CatalogTag[] {
        if (!Array.isArray(row['tags'])) {
            // Oldest shape: a boolean with no tag vocabulary behind it.
            return row['isFeatured'] === true
                ? [{ id: '', name: '', pinsToTop: true }]
                : [];
        }
        // Both key spaces are tracked, not just whichever the entry carries:
        // the same tag can arrive once as an object and once as a bare name,
        // and matching on only one of them would show it twice. Names are safe
        // to dedupe on because the catalog enforces them unique.
        const seenIds = new Set<string>();
        const seenNames = new Set<string>();
        const tags: CatalogTag[] = [];
        for (const entry of row['tags'] as unknown[]) {
            const tag =
                typeof entry === 'string'
                    ? { id: '', name: entry, pinsToTop: false }
                    : this._tagOf(entry);
            if (!tag) {
                continue;
            }
            const name = normalizeTagNames([tag.name])[0] ?? '';
            if (!tag.id && !name) {
                continue;
            }
            if (
                (tag.id && seenIds.has(tag.id)) ||
                (name && seenNames.has(name))
            ) {
                continue;
            }
            if (tag.id) {
                seenIds.add(tag.id);
            }
            if (name) {
                seenNames.add(name);
            }
            tags.push({ ...tag, name });
        }
        return tags;
    }

    /** One `MarketProductTagDto`, or null when the entry is not one. */
    private _tagOf(entry: unknown): CatalogTag | null {
        if (!entry || typeof entry !== 'object') {
            return null;
        }
        const record = entry as Record<string, unknown>;
        const name = str(record, ['name', 'tagName']);
        const id = str(record, ['id', 'tagId']);
        if (!name && !id) {
            return null;
        }
        return { id, name, pinsToTop: record['pinsToTop'] === true };
    }

    /**
     * Resolves a product for the detail route. Prefers what the grid already
     * loaded; on a deep link it reads the selected market's listing through the
     * shared cache — without `onProgress`, so the crawl fills the cache for the
     * catalog page without writing into a grid this route is not showing.
     */
    private async _resolveProduct(productId: string): Promise<CatalogProduct> {
        const inGrid = this._products().find(
            (product) => product.productId === productId
        );
        if (inGrid) {
            return inGrid;
        }

        const marketId = this._marketSelection.selectedId();
        if (!marketId) {
            throw new Error('No market selected');
        }

        const listing = await this._getMarketListing(marketId);
        const found = listing.products.find(
            (product) => product.productId === productId
        );
        if (!found) {
            throw new Error(`Product ${productId} not found`);
        }
        return found;
    }
}
