import { Routes } from '@angular/router';
import { AuthGuard } from 'app/core/auth/guards/auth.guard';
import { ProfileComponent } from './profile.component';

/**
 * Own-profile area (`/profile`, M2 — every role has a full personal profile).
 * Reached from the header's account menu, not the sidebar nav. Restaurant
 * users get the full self-service area (business/tax profile, delivery
 * addresses, credit, orders, invoices); other roles see basic account info —
 * `ProfileComponent` branches on the signed-in role. Any authenticated user
 * may open it — `AuthGuard` only redirects guests to sign-in.
 */
export default [
    {
        path: '',
        canActivate: [AuthGuard],
        component: ProfileComponent,
    },
] as Routes;
