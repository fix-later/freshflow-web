import { Routes } from '@angular/router';
import { roleGuard } from 'app/core/auth/guards/role.guard';
import { OrderDetailComponent } from './pages/order-detail/order-detail.component';

/**
 * The list lives as the "Lịch sử đơn hàng" tab on `/profile` — only the
 * detail page is a real route here, so a bare `/orders` (bookmark, typo)
 * lands somewhere useful instead of a blank outlet.
 */
export default [
    { path: '', redirectTo: '/profile?tab=orders', pathMatch: 'full' },
    {
        path: ':orderId',
        canActivate: [roleGuard(['restaurant'])],
        component: OrderDetailComponent,
    },
] as Routes;
