import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './analytics/analytics-dashboard.component';
import { AuditLogsComponent } from './audit-logs/audit-logs.component';
import { CategoriesComponent } from './catalog/categories.component';
import { MarketCreateComponent } from './catalog/market-create.component';
import { MarketEditComponent } from './catalog/market-edit.component';
import { MarketsComponent } from './catalog/markets.component';
import { PackingCodesComponent } from './catalog/packing-codes.component';
import { ProductCreateComponent } from './catalog/product-create.component';
import { ProductsComponent } from './catalog/products.component';
import { UnitsComponent } from './catalog/units.component';
import { FinanceComponent } from './finance/finance.component';
import { InvoiceDetailComponent } from './invoices/invoice-detail.component';
import { InvoicesListComponent } from './invoices/invoices-list.component';
import { HubEditComponent } from './logistics/hub-edit.component';
import { HubsComponent } from './logistics/hubs.component';
import { RouteCreateComponent } from './logistics/route-create.component';
import { RouteDetailComponent } from './logistics/route-detail.component';
import { RoutesListComponent } from './logistics/routes-list.component';
import { VehiclesComponent } from './logistics/vehicles.component';
import { OrderGroupDetailComponent } from './order-groups/order-group-detail.component';
import { OrderGroupsComponent } from './order-groups/order-groups.component';
import { OrderDetailComponent } from './orders/order-detail.component';
import { OrdersListComponent } from './orders/orders-list.component';
import { RestaurantDetailComponent } from './restaurants/restaurant-detail.component';
import { RestaurantsAdminComponent } from './restaurants/restaurants-admin.component';
import { RestaurantsCreateComponent } from './restaurants/restaurants-create.component';
import { OrderGroupSettingsPageComponent } from './settings/order-group-settings-page.component';
import { UsersCreateComponent } from './users/users-create.component';
import { UsersListComponent } from './users/users-list.component';

export default [
    {
        path: '',
        component: AdminDashboardComponent,
    },
    // Accounts (M13)
    {
        path: 'users/new',
        component: UsersCreateComponent,
    },
    {
        path: 'users',
        component: UsersListComponent,
    },
    {
        path: 'restaurants/new',
        component: RestaurantsCreateComponent,
    },
    {
        path: 'restaurants/:userId',
        component: RestaurantDetailComponent,
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
        path: 'products/new',
        component: ProductCreateComponent,
    },
    {
        path: 'products',
        component: ProductsComponent,
    },
    {
        path: 'packing-codes',
        component: PackingCodesComponent,
    },
    {
        path: 'markets/new',
        component: MarketCreateComponent,
    },
    {
        path: 'markets',
        component: MarketsComponent,
    },
    {
        path: 'markets/:marketId/products',
        component: MarketEditComponent,
        data: { tab: 'pricing' },
    },
    {
        path: 'markets/:marketId',
        component: MarketEditComponent,
    },
    // Logistics configuration (M8 / M9)
    {
        path: 'hubs',
        component: HubsComponent,
    },
    {
        path: 'hubs/:hubId',
        component: HubEditComponent,
    },
    {
        path: 'routes',
        component: RoutesListComponent,
    },
    {
        path: 'routes/new',
        component: RouteCreateComponent,
    },
    {
        path: 'routes/:routeId',
        component: RouteDetailComponent,
    },
    {
        path: 'vehicles',
        component: VehiclesComponent,
    },
    // Orders (M5)
    {
        path: 'orders',
        component: OrdersListComponent,
    },
    {
        path: 'orders/:orderId',
        component: OrderDetailComponent,
    },
    // Procurement batching (M5)
    {
        path: 'order-groups',
        component: OrderGroupsComponent,
    },
    {
        path: 'finance',
        component: FinanceComponent,
    },
    {
        path: 'order-groups/:batchId',
        component: OrderGroupDetailComponent,
    },
    {
        path: 'order-group-settings',
        component: OrderGroupSettingsPageComponent,
    },
    // Financial oversight (extends M6 Credit)
    {
        path: 'invoices',
        component: InvoicesListComponent,
    },
    {
        path: 'invoices/:invoiceId',
        component: InvoiceDetailComponent,
    },
    // Audit trail (M13)
    {
        path: 'audit-logs',
        component: AuditLogsComponent,
    },
] as Routes;
