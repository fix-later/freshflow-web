import { Routes } from '@angular/router';
import { roleGuard } from 'app/core/auth/guards/role.guard';
import { OrdersHistoryPageComponent } from './orders-history-page.component';
import { OrderDetailComponent } from './pages/order-detail/order-detail.component';

/**
 * `/orders` — the restaurant's own order history (M5), wrapped in
 * `account-shell` alongside `/profile` and `/settings`. `/orders/:orderId`
 * is the detail page. Both are restaurant-only, matching the role that owns
 * an order history in the first place.
 */
export default [
    {
        path: '',
        canActivate: [roleGuard(['restaurant'])],
        component: OrdersHistoryPageComponent,
    },
    {
        path: ':orderId',
        canActivate: [roleGuard(['restaurant'])],
        component: OrderDetailComponent,
    },
] as Routes;
