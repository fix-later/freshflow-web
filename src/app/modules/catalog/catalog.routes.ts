import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Routes } from '@angular/router';
import { UnauthorizedError } from 'contract';
import { OperatorFunction, catchError, of, throwError } from 'rxjs';
import { CatalogComponent } from './catalog.component';
import { CatalogService } from './catalog.service';
import { ProductDetailComponent } from './pages/product-detail/product-detail.component';

/**
 * Guests may open catalog pages even when the API rejects the data requests
 * (guest GET 401s fail silently); the page renders its empty state instead
 * of the navigation being cancelled. Other errors still propagate.
 */
function tolerateUnauthorized<T>(): OperatorFunction<T, T | null> {
    return catchError((err: unknown) =>
        err instanceof UnauthorizedError ? of(null) : throwError(() => err)
    );
}

export default [
    {
        path: '',
        component: CatalogComponent,
        resolve: {
            // Only the filter data is resolved up front. Product listings are
            // scoped to the market picked in the header and paged as the user
            // scrolls, so `CatalogComponent` drives them — resolving them here
            // would block navigation on a fetch that depends on a choice the
            // route knows nothing about.
            data: () =>
                inject(CatalogService)
                    .getCategories()
                    .pipe(tolerateUnauthorized()),
        },
    },
    {
        path: ':productId',
        component: ProductDetailComponent,
        resolve: {
            product: (route: ActivatedRouteSnapshot) => {
                const catalogService = inject(CatalogService);
                return catalogService
                    .getProductById(route.params['productId'])
                    .pipe(tolerateUnauthorized());
            },
        },
    },
] as Routes;
