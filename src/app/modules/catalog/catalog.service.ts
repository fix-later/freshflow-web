import { computed, inject, Injectable, signal } from '@angular/core';
import {
    extractList,
    extractNextCursor,
    fetchAllOffset,
    parseJson,
} from 'app/core/api/envelope';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { categoriesApi, marketsApi, productsApi } from 'contract';
import { from, Observable, tap } from 'rxjs';
import { CatalogCategory, CatalogProduct, PricePoint } from './catalog.types';

/** A root category with the children the API reports beneath it. */
export interface CategoryNode extends CatalogCategory {
    children: CatalogCategory[];
}

/** Listings fetched per request — one screenful, then infinite scroll. */
export const CATALOG_PAGE_SIZE = 20;

/**
 * Catalog data access — backed by the generated, typed OpenAPI client
 * (`typescript-fetch`) instead of a handwritten `HttpClient` call.
 *
 * **Scoped to the selected market.** Price and availability are per-market, so
 * the catalog lists `GET /markets/{marketId}/products` for the market chosen in
 * the header (`MarketSelectionService`) — not an aggregate across every market.
 * That endpoint is cursor-paginated, and the catalog walks it
 * {@link CATALOG_PAGE_SIZE} rows at a time as the user scrolls, rather than
 * crawling every page up front.
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
    private _hasMore = signal(false);

    /** Cursor for the next page; `undefined` before the first page is read. */
    private _cursor: string | undefined;
    /** Identifies the active query so a stale response cannot overwrite it. */
    private _requestKey = '';
    private _baseProducts: Promise<Map<string, RawRow>> | null = null;
    /**
     * Cached category fetch. Both the catalog page (sidebar tree) and the
     * header (mega menu) call {@link getCategories}, and without this they'd
     * each fire their own `GET /categories` for the same session-lifetime data.
     */
    private _categoriesPromise: Promise<CatalogCategory[]> | null = null;

    readonly categories = this._categories.asReadonly();
    /** True while the first (uncached) category fetch of the session is in flight. */
    readonly categoriesLoading = this._categoriesLoading.asReadonly();
    readonly products = this._products.asReadonly();
    readonly product = this._product.asReadonly();
    /** True while a page is in flight — drives the scroll spinner. */
    readonly loading = this._loading.asReadonly();
    /** True when the server reported another page after the last one. */
    readonly hasMore = this._hasMore.asReadonly();

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
     * Starts a fresh listing for `marketId`, replacing whatever was loaded.
     * Call on entry and whenever the market or category filter changes.
     */
    async loadFirstPage(
        marketId: string | null,
        categoryId?: string
    ): Promise<void> {
        this._cursor = undefined;
        this._requestKey = `${marketId ?? ''}|${categoryId ?? ''}`;
        this._products.set([]);
        this._hasMore.set(false);

        if (!marketId) {
            // No market chosen yet — the catalog shows its "pick a market"
            // state rather than an arbitrary market's products.
            return;
        }
        await this._loadPage(marketId, categoryId);
    }

    /** Appends the next page. No-op while loading or at the end of the list. */
    async loadNextPage(): Promise<void> {
        const marketId = this._marketSelection.selectedId();
        if (!marketId || this._loading() || !this._hasMore()) {
            return;
        }
        const [, categoryId] = this._requestKey.split('|');
        await this._loadPage(marketId, categoryId || undefined);
    }

    getProductById(productId: string): Observable<CatalogProduct> {
        return from(this._resolveProduct(productId)).pipe(
            tap((product) => this._product.set(product))
        );
    }

    /**
     * Recorded price points for one market's listing, oldest first, so the
     * product page can show whether today's price is unusual. Reads tolerantly
     * (the endpoint is untyped) and returns an empty series rather than
     * throwing — a missing chart must never break the product page.
     */
    async getPriceHistory(
        marketId: string,
        productId: string,
        days = 30
    ): Promise<PricePoint[]> {
        const from = new Date();
        from.setDate(from.getDate() - days);
        try {
            const res =
                await marketsApi.apiV1MarketsMarketIdProductsProductIdPriceHistoryGetRaw(
                    {
                        marketId,
                        productId,
                        from: from.toISOString(),
                        pageSize: 100,
                    }
                );
            const rows = extractList<RawRow>(await parseJson(res.raw));
            return rows
                .map((row) => ({
                    recordedAt: str(row, ['recordedAt', 'date', 'createdAt']),
                    price: num(row, ['price', 'unitPrice', 'value']),
                }))
                .filter(
                    (point): point is PricePoint =>
                        !!point.recordedAt && point.price !== null
                )
                .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
        } catch {
            return [];
        }
    }

    /**
     * Reads one page and appends it. Guards against out-of-order responses:
     * switching market mid-flight changes `_requestKey`, and the late response
     * for the previous market is then dropped instead of mixing in.
     */
    private async _loadPage(
        marketId: string,
        categoryId?: string
    ): Promise<void> {
        const key = this._requestKey;
        const cursor = this._cursor;
        this._loading.set(true);
        try {
            const res = await marketsApi.apiV1MarketsMarketIdProductsGetRaw({
                marketId,
                category: categoryId || undefined,
                cursor,
                pageSize: CATALOG_PAGE_SIZE,
            });
            const body = await parseJson(res.raw);
            if (key !== this._requestKey) {
                return;
            }

            const rows = extractList<RawRow>(body);
            const market = this._marketSelection.selected() ?? {
                id: marketId,
                name: '',
            };
            const baseById = await this._loadBaseProducts();
            if (key !== this._requestKey) {
                return;
            }

            const page = rows
                .map((row) => this._toCatalogProduct(row, market, baseById))
                .filter((product): product is CatalogProduct => !!product);
            this._products.update((current) => [...current, ...page]);

            const next = extractNextCursor(body);
            // A short page means the end even when the backend still hands back
            // a cursor, and a repeated cursor would loop forever.
            this._hasMore.set(
                !!next && next !== cursor && rows.length >= CATALOG_PAGE_SIZE
            );
            this._cursor = next;
        } catch {
            if (key === this._requestKey) {
                this._hasMore.set(false);
            }
        } finally {
            if (key === this._requestKey) {
                this._loading.set(false);
            }
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
        const thumbnail =
            str(base, ['thumbnail', 'imageUrl']) || images[0] || '';
        const name = str(row, ['productName']) || str(base, ['name']);
        const description = str(base, ['description']);
        // The market-product row's own id — distinct from the base productId
        // above. Not documented in the spec (the GET response has no declared
        // schema), but favorites/analytics key on this as `marketProductId`,
        // so capture it defensively; falls back to the composite id if the
        // row genuinely has no separate identifier.
        const marketProductId =
            str(row, ['marketProductId', 'id']) || `${productId}:${market.id}`;
        return {
            id: `${productId}:${market.id}`,
            productId,
            marketProductId,
            name,
            nameEn: str(base, ['nameEn']) || name,
            description,
            descriptionEn: str(base, ['descriptionEn']) || description,
            categoryId: str(row, ['categoryId']) || str(base, ['categoryId']),
            unit: str(base, ['unitName', 'unit']),
            unitEn:
                str(base, ['unitAbbreviation', 'unitEn']) ||
                str(base, ['unitName', 'unit']),
            marketId: market.id,
            marketSource: market.name,
            price: num(row, ['price', 'currentPrice']),
            quantity: num(row, ['availableQuantity', 'quantity']),
            // Lives on the product, not the market listing, so it is read from
            // `base`. A missing or nonsensical value means "no minimum", which
            // is what the backend's own default of 1 amounts to.
            minimumOrderQuantity: Math.max(
                1,
                num(base, ['minimumOrderQuantity']) ?? 1
            ),
            thumbnail,
            images,
            active: base['active'] !== false,
        };
    }

    /**
     * Resolves a product for the detail route. Prefers what the grid already
     * loaded; on a deep link (nothing loaded yet) it walks the selected market's
     * listing until the product turns up, which costs one page for anything the
     * user could plausibly have linked from.
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

        await this.loadFirstPage(marketId);
        for (;;) {
            const found = this._products().find(
                (product) => product.productId === productId
            );
            if (found) {
                return found;
            }
            if (!this._hasMore()) {
                throw new Error(`Product ${productId} not found`);
            }
            await this.loadNextPage();
        }
    }
}
