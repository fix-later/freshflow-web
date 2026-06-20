import { Injectable } from '@angular/core';
import { FuseMockApiService } from '@fuse/lib/mock-api';
import {
    categories as categoriesData,
    products as productsData,
} from 'app/mock-api/apps/catalog/data';
import {
    CatalogCategory,
    CatalogProduct,
} from 'app/modules/catalog/catalog.types';
import { cloneDeep } from 'lodash-es';

@Injectable({ providedIn: 'root' })
export class CatalogMockApi {
    private _categories: CatalogCategory[] = categoriesData;
    private _products: CatalogProduct[] = productsData;

    constructor(private _fuseMockApiService: FuseMockApiService) {
        this.registerHandlers();
    }

    registerHandlers(): void {
        // Categories - GET
        this._fuseMockApiService
            .onGet('api/apps/catalog/categories')
            .reply(() => [200, cloneDeep(this._categories)]);

        // Products - GET (with search, category filter, sort, pagination)
        this._fuseMockApiService
            .onGet('api/apps/catalog/products')
            .reply(({ request }) => {
                const search = request.params.get('search');
                const category = request.params.get('category');
                const sort = request.params.get('sort') || 'name';
                const order = request.params.get('order') || 'asc';
                const page = parseInt(request.params.get('page') ?? '0', 10);
                const size = parseInt(request.params.get('size') ?? '12', 10);

                let products: CatalogProduct[] | null = cloneDeep(
                    this._products
                ).filter((p) => p.active);

                if (category) {
                    products = products.filter(
                        (p) => p.categoryId === category
                    );
                }

                if (search) {
                    const q = search.toLowerCase();
                    products = products.filter(
                        (p) =>
                            p.name.toLowerCase().includes(q) ||
                            p.nameEn.toLowerCase().includes(q)
                    );
                }

                products.sort((a, b) => {
                    const fieldA = (a[sort as keyof CatalogProduct] ?? '')
                        .toString()
                        .toUpperCase();
                    const fieldB = (b[sort as keyof CatalogProduct] ?? '')
                        .toString()
                        .toUpperCase();
                    return order === 'asc'
                        ? fieldA.localeCompare(fieldB)
                        : fieldB.localeCompare(fieldA);
                });

                const productsLength = products.length;
                const begin = page * size;
                const end = Math.min(size * (page + 1), productsLength);
                const lastPage = Math.max(Math.ceil(productsLength / size), 1);

                let pagination;

                if (page > lastPage) {
                    products = null;
                    pagination = { lastPage };
                } else {
                    products = products.slice(begin, end);
                    pagination = {
                        length: productsLength,
                        size,
                        page,
                        lastPage,
                        startIndex: begin,
                        endIndex: end - 1,
                    };
                }

                return [200, { products, pagination }];
            });

        // Product - GET by id
        this._fuseMockApiService
            .onGet('api/apps/catalog/product')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const product = cloneDeep(
                    this._products.find((p) => p.id === id)
                );

                return [200, product ?? null];
            });
    }
}
