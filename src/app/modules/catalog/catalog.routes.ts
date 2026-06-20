import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Routes } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CatalogComponent } from './catalog.component';
import { CatalogService } from './catalog.service';
import { ProductDetailComponent } from './pages/product-detail/product-detail.component';

export default [
    {
        path: '',
        component: CatalogComponent,
        resolve: {
            data: () => {
                const catalogService = inject(CatalogService);
                return forkJoin([
                    catalogService.getCategories(),
                    catalogService.getProducts({ page: 0, size: 12 }),
                ]);
            },
        },
    },
    {
        path: ':productId',
        component: ProductDetailComponent,
        resolve: {
            product: (route: ActivatedRouteSnapshot) => {
                const catalogService = inject(CatalogService);
                return catalogService.getProductById(route.params['productId']);
            },
        },
    },
] as Routes;
