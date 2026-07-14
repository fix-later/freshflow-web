import { Routes } from '@angular/router';
import { CategoriesComponent } from './catalog/categories.component';
import { MarketProductsComponent } from './catalog/market-products.component';
import { MarketsComponent } from './catalog/markets.component';
import { ProductsComponent } from './catalog/products.component';
import { UnitsComponent } from './catalog/units.component';
import { AdminDashboardComponent } from './dashboard.component';
import { DeliveryZonesComponent } from './logistics/delivery-zones.component';
import { HubsComponent } from './logistics/hubs.component';
import { VehiclesComponent } from './logistics/vehicles.component';
import { RestaurantsAdminComponent } from './restaurants/restaurants-admin.component';
import { UserDetailComponent } from './users/user-detail.component';
import { UsersListComponent } from './users/users-list.component';

export default [
    {
        path: '',
        component: AdminDashboardComponent,
    },
    // Accounts & restaurants (M13)
    {
        path: 'users',
        component: UsersListComponent,
    },
    {
        path: 'users/:userId',
        component: UserDetailComponent,
    },
    {
        path: 'restaurants',
        component: RestaurantsAdminComponent,
    },
    // Catalog master data (M3)
    {
        path: 'categories',
        component: CategoriesComponent,
    },
    {
        path: 'units',
        component: UnitsComponent,
    },
    {
        path: 'products',
        component: ProductsComponent,
    },
    {
        path: 'markets',
        component: MarketsComponent,
    },
    {
        path: 'markets/:marketId/products',
        component: MarketProductsComponent,
    },
    // Logistics configuration (M8 / M9)
    {
        path: 'hubs',
        component: HubsComponent,
    },
    {
        path: 'vehicles',
        component: VehiclesComponent,
    },
    {
        path: 'delivery-zones',
        component: DeliveryZonesComponent,
    },
] as Routes;
