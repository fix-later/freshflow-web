import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { CategoriesComponent } from './catalog/categories.component';
import { MarketCreateComponent } from './catalog/market-create.component';
import { MarketEditComponent } from './catalog/market-edit.component';
import { MarketProductPriceHistoryComponent } from './catalog/market-product-price-history.component';
import { MarketsComponent } from './catalog/markets.component';
import { PackingCodesComponent } from './catalog/packing-codes.component';
import { ProductsComponent } from './catalog/products.component';
import { TagsComponent } from './catalog/tags.component';
import { UnitsComponent } from './catalog/units.component';
import { AdminDashboardComponent } from './dashboard/admin-dashboard.component';
import { DashboardTabSlug } from './dashboard/dashboard-tabs';
import { HubEditComponent } from './logistics/hub-edit.component';
import { HubsComponent } from './logistics/hubs.component';
import { VehiclesComponent } from './logistics/vehicles.component';
import { OrderGroupDetailComponent } from './order-groups/order-group-detail.component';
import { OrderGroupsComponent } from './order-groups/order-groups.component';
import { RestaurantDetailComponent } from './restaurants/restaurant-detail.component';
import { ScheduledOrderDetailComponent } from './scheduled-orders/scheduled-order-detail.component';
import { ScheduledOrdersListComponent } from './scheduled-orders/scheduled-orders-list.component';
import { OrderGroupSettingsPageComponent } from './settings/order-group-settings-page.component';
import { StaffListComponent } from './staff/staff-list.component';
import { UsersListComponent } from './users/users-list.component';

/**
 * Sends a retired per-panel path to the dashboard tab that absorbed it.
 *
 * A redirect rather than a second route onto the same component: with two URLs
 * rendering the dashboard, switching tabs from `/admin/finance` would write
 * `/admin/finance?tab=claims` — a path naming one panel and a query naming
 * another. One canonical URL avoids that, and keeps the nav's `exactMatch`
 * highlight honest.
 *
 * `tab` is the slug union rather than a string: an unrecognised slug is not an
 * error at runtime — `dashboardTabIndexOf` falls back to analytics — so a typo
 * here would silently send `/admin/audit-logs` to the wrong panel. The compiler
 * catches it instead.
 */
const toDashboardTab = (tab: DashboardTabSlug) => () =>
    inject(Router).parseUrl(`/admin?tab=${tab}`);

export default [
    // The console's one reporting page: analytics · incidents · finance ·
    // claims · activity behind a tab bar. The redirects further down are the
    // destinations those panels used to have — kept so existing links and
    // bookmarks still land on the right tab rather than 404ing.
    {
        path: '',
        component: AdminDashboardComponent,
    },
    // Accounts (M13).
    //
    // Restaurants have no screen of their own: the list is the users page's
    // restaurant tab, and creating one is creating a user with that role. Only
    // the profile page stays, which that tab and the finance screen open.
    {
        path: 'users',
        component: UsersListComponent,
    },
    {
        path: 'restaurants/:userId',
        component: RestaurantDetailComponent,
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
    // Quản trị (M8 / M9 / M13) — the network behind the chợ, listed platform
    // wide: hubs, the people working them, and the fleet. Each chợ page still
    // manages its own; these three answer the question a single chợ cannot,
    // which is what the whole network looks like.
    {
        path: 'hubs',
        component: HubsComponent,
    },
    {
        path: 'hubs/:hubId',
        component: HubEditComponent,
    },
    {
        path: 'staff',
        component: StaffListComponent,
    },
    {
        path: 'vehicles',
        component: VehiclesComponent,
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
        redirectTo: toDashboardTab('finance'),
    },
    {
        path: 'order-groups/:batchId',
        component: OrderGroupDetailComponent,
    },
    {
        path: 'order-group-settings',
        component: OrderGroupSettingsPageComponent,
    },
    // Shortage/damage claims — approving refunds against the restaurant's
    // credit, so this sits with the financial oversight screens (M6 Credit).
    {
        path: 'claims',
        redirectTo: toDashboardTab('claims'),
    },
    // The audit trail. It had a screen but no nav entry and no route, so it was
    // unreachable; it is the dashboard's fourth tab now.
    {
        path: 'audit-logs',
        redirectTo: toDashboardTab('activity'),
    },
] as Routes;
