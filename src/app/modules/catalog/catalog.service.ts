import { Injectable, signal } from '@angular/core';
import { categoriesApi, productsApi } from 'contract';
import { from, Observable, tap } from 'rxjs';
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from './catalog.demo-data';
import {
    CatalogCategory,
    CatalogPagination,
    CatalogProduct,
} from './catalog.types';

/**
 * Catalog data access — backed by the generated, typed OpenAPI client
 * (`typescript-fetch`) instead of a handwritten `HttpClient` call.
 *
 * Note: the backend's OpenAPI spec does not yet declare response schemas for
 * its GET endpoints (they are documented only as "200 OK"), so the generated
 * client types reads as `void`. Until the backend publishes response models we
 * call the generated `*Raw` methods (which build the URL, query string, bearer
 * auth and error handling for us) and parse the body here, treating
 * `catalog.types.ts` as the provisional response contract. Bodies are unwrapped
 * from the `{ success, data }` envelope the API uses.
 */
interface ApiEnvelope<T> {
    success?: boolean;
    data?: T;
}

interface ProductListData {
    items?: CatalogProduct[];
    products?: CatalogProduct[];
    totalCount?: number;
}

/** Unwraps the `{ success, data }` envelope, tolerating a bare body too. */
function unwrap<T>(body: unknown): T | undefined {
    if (body && typeof body === 'object' && 'data' in body) {
        return (body as ApiEnvelope<T>).data;
    }
    return body as T;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
    private _categories = signal<CatalogCategory[]>([]);
    private _products = signal<CatalogProduct[]>([]);
    private _product = signal<CatalogProduct | null>(null);
    private _pagination = signal<CatalogPagination | null>(null);

    /**
     * Once the API proves unreachable or empty, all catalog reads are served
     * from the bundled demo dataset (catalog.demo-data.ts) with client-side
     * filtering, so the catalog stays browsable in dev and demos.
     */
    private _demoMode = false;

    readonly categories = this._categories.asReadonly();
    readonly products = this._products.asReadonly();
    readonly product = this._product.asReadonly();
    readonly pagination = this._pagination.asReadonly();

    getCategories(): Observable<CatalogCategory[]> {
        return from(this._loadCategories()).pipe(
            tap((categories) => this._categories.set(categories))
        );
    }

    getProducts(
        params: {
            search?: string;
            category?: string;
            sort?: string;
            order?: string;
            page?: number;
            size?: number;
        } = {}
    ): Observable<{
        products: CatalogProduct[];
        pagination: CatalogPagination;
    }> {
        return from(this._loadProducts(params)).pipe(
            tap((response) => {
                this._products.set(response.products);
                this._pagination.set(response.pagination);
            })
        );
    }

    getProductById(id: string): Observable<CatalogProduct> {
        return from(this._loadProduct(id)).pipe(
            tap((product) => this._product.set(product))
        );
    }

    private async _loadCategories(): Promise<CatalogCategory[]> {
        if (!this._demoMode) {
            try {
                // `activeOnly` is a typed, generated request parameter.
                const res = await categoriesApi.apiV1CategoriesGetRaw({
                    activeOnly: true,
                });
                const categories =
                    unwrap<CatalogCategory[]>(await res.raw.json()) ?? [];
                if (categories.length) {
                    return categories;
                }
            } catch {
                // Fall through to the demo dataset.
            }
            this._demoMode = true;
        }
        return DEMO_CATEGORIES;
    }

    private async _loadProducts(params: {
        search?: string;
        category?: string;
        page?: number;
        size?: number;
    }): Promise<{ products: CatalogProduct[]; pagination: CatalogPagination }> {
        const page = params.page ?? 0;
        const size = params.size ?? 12;

        if (!this._demoMode) {
            try {
                // Typed request model (ApiV1ProductsGetRequest) — no hand-built URLs.
                const res = await productsApi.apiV1ProductsGetRaw({
                    search: params.search || undefined,
                    category: params.category || undefined,
                    page: page + 1, // component is 0-based; the API is 1-based
                    pageSize: size,
                });

                const data = unwrap<ProductListData | CatalogProduct[]>(
                    await res.raw.json()
                );
                const products = Array.isArray(data)
                    ? data
                    : data?.items ?? data?.products ?? [];
                const total = Array.isArray(data)
                    ? products.length
                    : data?.totalCount ?? products.length;

                // An empty UNFILTERED first page means the backend has no
                // data yet — switch to the demo dataset. A filtered empty
                // result is a legitimate "no matches".
                if (products.length || params.search || params.category) {
                    return {
                        products,
                        pagination: this._buildPagination(page, size, total),
                    };
                }
            } catch {
                // Fall through to the demo dataset.
            }
            this._demoMode = true;
        }
        return this._loadDemoProducts(params, page, size);
    }

    private _loadDemoProducts(
        params: { search?: string; category?: string },
        page: number,
        size: number
    ): { products: CatalogProduct[]; pagination: CatalogPagination } {
        const search = (params.search ?? '').trim().toLowerCase();
        const matches = DEMO_PRODUCTS.filter(
            (product) =>
                (!params.category || product.categoryId === params.category) &&
                (!search ||
                    product.name.toLowerCase().includes(search) ||
                    product.nameEn.toLowerCase().includes(search))
        );
        return {
            products: matches.slice(page * size, page * size + size),
            pagination: this._buildPagination(page, size, matches.length),
        };
    }

    private async _loadProduct(id: string): Promise<CatalogProduct> {
        if (!this._demoMode) {
            try {
                const res = await productsApi.apiV1ProductsIdGetRaw({ id });
                const product = unwrap<CatalogProduct>(await res.raw.json());
                if (product) {
                    return product;
                }
            } catch {
                // Fall through to the demo dataset.
            }
        }
        const demoProduct = DEMO_PRODUCTS.find((product) => product.id === id);
        if (!demoProduct) {
            throw new Error(`Product ${id} not found`);
        }
        return demoProduct;
    }

    private _buildPagination(
        page: number,
        size: number,
        length: number
    ): CatalogPagination {
        const lastPage = Math.max(Math.ceil(length / size) - 1, 0);
        const startIndex = page * size;
        const endIndex = Math.min(startIndex + size - 1, length - 1);
        return { length, size, page, lastPage, startIndex, endIndex };
    }
}
