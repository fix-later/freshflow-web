import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
    CatalogCategory,
    CatalogPagination,
    CatalogProduct,
} from './catalog.types';

@Injectable({ providedIn: 'root' })
export class CatalogService {
    private _httpClient = inject(HttpClient);

    private _categories = signal<CatalogCategory[]>([]);
    private _products = signal<CatalogProduct[]>([]);
    private _product = signal<CatalogProduct | null>(null);
    private _pagination = signal<CatalogPagination | null>(null);

    readonly categories = this._categories.asReadonly();
    readonly products = this._products.asReadonly();
    readonly product = this._product.asReadonly();
    readonly pagination = this._pagination.asReadonly();

    getCategories(): Observable<CatalogCategory[]> {
        return this._httpClient
            .get<CatalogCategory[]>('api/apps/catalog/categories')
            .pipe(tap((categories) => this._categories.set(categories)));
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
        let httpParams = new HttpParams();
        if (params.search) {
            httpParams = httpParams.set('search', params.search);
        }
        if (params.category) {
            httpParams = httpParams.set('category', params.category);
        }
        if (params.sort) {
            httpParams = httpParams.set('sort', params.sort);
        }
        if (params.order) {
            httpParams = httpParams.set('order', params.order);
        }
        if (params.page != null) {
            httpParams = httpParams.set('page', params.page.toString());
        }
        if (params.size != null) {
            httpParams = httpParams.set('size', params.size.toString());
        }

        return this._httpClient
            .get<{
                products: CatalogProduct[];
                pagination: CatalogPagination;
            }>('api/apps/catalog/products', { params: httpParams })
            .pipe(
                tap((response) => {
                    this._products.set(response.products ?? []);
                    this._pagination.set(response.pagination);
                })
            );
    }

    getProductById(id: string): Observable<CatalogProduct> {
        return this._httpClient
            .get<CatalogProduct>('api/apps/catalog/product', {
                params: { id },
            })
            .pipe(tap((product) => this._product.set(product)));
    }
}
