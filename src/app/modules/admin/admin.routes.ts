import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './analytics/analytics-dashboard.component';
import { AuditLogsComponent } from './audit-logs/audit-logs.component';
import { CategoriesComponent } from './catalog/categories.component';
import { MarketCreateComponent } from './catalog/market-create.component';
import { MarketEditComponent } from './catalog/market-edit.component';
import { MarketProductPriceHistoryComponent } from './catalog/market-product-price-history.component';
import { MarketsComponent } from './catalog/markets.component';
import { PackingCodesComponent } from './catalog/packing-codes.component';
import { ProductsComponent } from './catalog/products.component';
import { TagsComponent } from './catalog/tags.component';
import { UnitsComponent } from './catalog/units.component';
import { ClaimsListComponent } from './claims/claims-list.component';
import { FinanceComponent } from './finance/finance.component';
import { InvoiceDetailComponent } from './invoices/invoice-detail.component';
import { InvoicesListComponent } from './invoices/invoices-list.component';
import { HubEditComponent } from './logistics/hub-edit.component';
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
import { ScheduledOrderDetailComponent } from './scheduled-orders/scheduled-order-detail.component';
import { ScheduledOrdersListComponent } from './scheduled-orders/scheduled-orders-list.component';
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
        path: 'products',
        component: ProductsComponent,
    },
    {
        path: 'packing-codes',
        component: PackingCodesComponent,
    },
    // Tag catalog (SCRUM-386) — the vocabulary market listings reference, and
    // where `pinsToTop` decides which tags pin a listing to the top of a board.
    {
        path: 'tags',
        component: TagsComponent,
    },
    {
        path: 'markets/new',
        component: MarketCreateComponent,
    },
    {
        path: 'markets',
        component: MarketsComponent,
    },
    // Before `markets/:marketId/products` — Angular matches in order, and the
    // shorter pattern would otherwise swallow this one's prefix.
    {
        path: 'markets/:marketId/products/:productId/price-history',
        component: MarketProductPriceHistoryComponent,
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
    // Logistics configuration (M8 / M9).
    //
    // Hubs have no list screen: they are created and listed inside their chợ's
    // hub tab. A hub's own page stays, for the staff roster and the
    // inbound/discrepancy oversight the tab has no room for.
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
    // Recurring orders (M5 — UC-ORD-09/10/11; the endpoints are
    // `admin,restaurant`, so Operations sees every restaurant's schedules)
    {
        path: 'scheduled-orders',
        component: ScheduledOrdersListComponent,
    },
    {
        path: 'scheduled-orders/:scheduledOrderId',
        component: ScheduledOrderDetailComponent,
    },
    // Procurement batching (M5)
    {
        path: 'order-groups/history',
        component: OrderGroupsComponent,
        data: { view: 'history' },
    },
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
    // Shortage/damage claims — approving refunds against the restaurant's
    // credit, so this sits with the financial oversight screens (M6 Credit).
    {
        path: 'claims',
        component: ClaimsListComponent,
    },
    // Audit trail (M13)
    {
        path: 'audit-logs',
        component: AuditLogsComponent,
    },
] as Routes;
