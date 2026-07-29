import { Injectable, signal } from '@angular/core';
import {
    extractList,
    fetchAllCursor,
    fetchAllOffset,
    parseJson,
} from 'app/core/api/envelope';
import { categoriesApi, marketsApi, productsApi } from 'contract';
import { from, Observable, tap } from 'rxjs';
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from './catalog.demo-data';
import { CatalogCategory, CatalogProduct } from './catalog.types';

/**
 * Catalog data access — backed by the generated, typed OpenAPI client
 * (`typescript-fetch`) instead of a handwritten `HttpClient` call.
 *
 * The base `/products` endpoint has no price. Price is per-market — the same
 * product can be listed (and priced) by more than one market — so the
 * catalog is built by crawling every market's `/markets/{marketId}/products`
 * listing and joining each row back to its base product for
 * name/description/category/unit. One row per (product, market) pair: a
 * product sold by two markets renders as two cards, each with its own price.
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
    private _categories = signal<CatalogCategory[]>([]);
    private _products = signal<CatalogProduct[]>([]);
    private _product = signal<CatalogProduct | null>(null);

    /**
     * Once the API proves unreachable or empty, all catalog reads are served
     * from the bundled demo dataset (catalog.demo-data.ts), so the catalog
     * stays browsable in dev and demos.
     */
    private _demoMode = false;

    readonly categories = this._categories.asReadonly();
    readonly products = this._products.asReadonly();
    readonly product = this._product.asReadonly();

    getCategories(): Observable<CatalogCategory[]> {
        return from(this._loadCategories()).pipe(
            tap((categories) => this._categories.set(categories))
        );
    }

    /** Loads every product listing across every market, once, with price. */
    getProducts(): Observable<CatalogProduct[]> {
        return from(this._loadAllProducts()).pipe(
            tap((products) => this._products.set(products))
        );
    }

    getProductById(productId: string): Observable<CatalogProduct> {
        return from(this._resolveProduct(productId)).pipe(
            tap((product) => this._product.set(product))
        );
    }

    private async _loadCategories(): Promise<CatalogCategory[]> {
        if (!this._demoMode) {
            try {
                const res = await categoriesApi.apiV1CategoriesGetRaw({
                    activeOnly: true,
                });
                const categories = extractList<CatalogCategory>(
                    await parseJson(res.raw)
                );
                if (categories.length) {
                    return categories;
                }
            } catch {
                // Fall through to the demo dataset.
            }
        }
        return DEMO_CATEGORIES;
    }

    private async _loadAllProducts(): Promise<CatalogProduct[]> {
        if (this._demoMode) {
            return DEMO_PRODUCTS;
        }
        try {
            const [baseProducts, markets] = await Promise.all([
                this._loadAllBaseProducts(),
                this._loadAllMarkets(),
            ]);
            const baseById = new Map(
                baseProducts.map((row) => [str(row, ['id', 'productId']), row])
            );
            const perMarket = await Promise.all(
                markets.map((market) =>
                    this._loadMarketProducts(market, baseById)
                )
            );
            const products = perMarket.flat();
            if (!products.length) {
                throw new Error('Catalog is empty');
            }
            return products;
        } catch {
            this._demoMode = true;
            return DEMO_PRODUCTS;
        }
    }

    private async _loadAllBaseProducts(): Promise<RawRow[]> {
        return fetchAllOffset<RawRow>((page, pageSize) =>
            productsApi
                .apiV1ProductsGetRaw({ includeInactive: false, page, pageSize })
                .then((res) => res.raw)
        );
    }

    /** The backend has no offset pagination for markets — one request returns all. */
    private async _loadAllMarkets(): Promise<{ id: string; name: string }[]> {
        const res = await marketsApi.apiV1MarketsGetRaw({ activeOnly: true });
        const rows = extractList<RawRow>(await parseJson(res.raw));
        return rows
            .map((row) => ({
                id: str(row, ['id', 'marketId']),
                name: str(row, ['name', 'marketName']),
            }))
            .filter((market) => !!market.id);
    }

    private async _loadMarketProducts(
        market: { id: string; name: string },
        baseById: Map<string, RawRow>
    ): Promise<CatalogProduct[]> {
        const rows = await fetchAllCursor<RawRow>((cursor, pageSize) =>
            marketsApi
                .apiV1MarketsMarketIdProductsGetRaw({
                    marketId: market.id,
                    cursor,
                    pageSize,
                })
                .then((res) => res.raw)
        );
        return rows
            .map((row) => this._toCatalogProduct(row, market, baseById))
            .filter((product): product is CatalogProduct => !!product);
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
            categoryId: str(base, ['categoryId']),
            unit: str(base, ['unitName', 'unit']),
            unitEn:
                str(base, ['unitAbbreviation', 'unitEn']) ||
                str(base, ['unitName', 'unit']),
            marketId: market.id,
            marketSource: market.name,
            price: num(row, ['price', 'currentPrice']),
            quantity: num(row, ['availableQuantity', 'quantity']),
            thumbnail,
            images,
            active: base['active'] !== false,
        };
    }

    /** Prefers the already-loaded aggregate cache; crawls once if empty (deep link). */
    private async _resolveProduct(productId: string): Promise<CatalogProduct> {
        let all = this._products();
        if (!all.length) {
            all = await this._loadAllProducts();
            this._products.set(all);
        }
        const found = all.find((product) => product.productId === productId);
        if (!found) {
            throw new Error(`Product ${productId} not found`);
        }
        return found;
    }
}
