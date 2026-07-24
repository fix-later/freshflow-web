import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './analytics/analytics-dashboard.component';
import { CategoriesComponent } from './catalog/categories.component';
import { MarketProductsComponent } from './catalog/market-products.component';
import { MarketsComponent } from './catalog/markets.component';
import { ProductsComponent } from './catalog/products.component';
import { UnitsComponent } from './catalog/units.component';
import { DeliveryZonesComponent } from './logistics/delivery-zones.component';
import { HubStaffComponent } from './logistics/hub-staff.component';
import { HubsComponent } from './logistics/hubs.component';
import { VehiclesComponent } from './logistics/vehicles.component';
import { OrderGroupsComponent } from './order-groups/order-groups.component';
import { RestaurantsAdminComponent } from './restaurants/restaurants-admin.component';
import { AdminSettingsComponent } from './settings/settings.component';
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
        path: 'hubs/:hubId/staff',
        component: HubStaffComponent,
    },
    {
        path: 'vehicles',
        component: VehiclesComponent,
    },
    {
        path: 'delivery-zones',
        component: DeliveryZonesComponent,
    },
    // Procurement batching (M5)
    {
        path: 'order-groups',
        component: OrderGroupsComponent,
    },
    // Platform configuration (M13)
    {
        path: 'settings',
        component: AdminSettingsComponent,
    },
] as Routes;
