import { Route } from '@angular/router';
import { initialDataResolver } from 'app/app.resolvers';
import { AuthGuard } from 'app/core/auth/guards/auth.guard';
import { NoAuthGuard } from 'app/core/auth/guards/noAuth.guard';
import { OptionalAuthGuard } from 'app/core/auth/guards/optionalAuth.guard';
import { roleGuard } from 'app/core/auth/guards/role.guard';
import { LayoutComponent } from 'app/layout/layout.component';
import { Error404Component } from 'app/modules/errors/error-404.component';
import { Error500Component } from 'app/modules/errors/error-500.component';

// Admin console area: roleGuard checks auth itself (redirects guests to
// sign-in with a redirectURL), so no separate AuthGuard is needed.
const adminOnly = roleGuard(['admin']);

// @formatter:off
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
export const appRoutes: Route[] = [
    // Redirect empty path to '/home'
    { path: '', pathMatch: 'full', redirectTo: 'home' },

    // Per-role landing after sign-in is decided in the auth components
    // (sign-in / unlock-session), where the profile — and therefore the role —
    // is already loaded. A synchronous `redirectTo` can't await that role.

    // Auth routes for guests
    {
        path: '',
        canActivate: [NoAuthGuard],
        canActivateChild: [NoAuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty',
        },
        children: [
            {
                path: 'confirmation-required',
                loadChildren: () =>
                    import(
                        'app/modules/auth/confirmation-required/confirmation-required.routes'
                    ),
            },
            {
                path: 'forgot-password',
                loadChildren: () =>
                    import(
                        'app/modules/auth/forgot-password/forgot-password.routes'
                    ),
            },
            {
                path: 'reset-password',
                loadChildren: () =>
                    import(
                        'app/modules/auth/reset-password/reset-password.routes'
                    ),
            },
            {
                path: 'sign-in',
                loadChildren: () =>
                    import('app/modules/auth/sign-in/sign-in.routes'),
            },
            {
                path: 'sign-up',
                loadChildren: () =>
                    import('app/modules/auth/sign-up/sign-up.routes'),
            },
        ],
    },

    // Auth routes for authenticated users
    {
        path: '',
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty',
        },
        children: [
            {
                path: 'sign-out',
                loadChildren: () =>
                    import('app/modules/auth/sign-out/sign-out.routes'),
            },
            {
                path: 'unlock-session',
                loadChildren: () =>
                    import(
                        'app/modules/auth/unlock-session/unlock-session.routes'
                    ),
            },
        ],
    },

    // Guided setup for a restaurant whose profile is not yet reviewable
    // (FR-005). Deliberately outside the storefront area and on the `empty`
    // layout: the wizard is a task to finish, and the storefront header, nav
    // and footer are all invitations to leave it half-done. The only way out
    // is the wizard's own exit, which is explicit about what is unsaved.
    {
        path: '',
        canActivate: [roleGuard(['restaurant'])],
        canActivateChild: [roleGuard(['restaurant'])],
        component: LayoutComponent,
        data: {
            layout: 'empty',
            theme: 'theme-default',
        },
        children: [
            {
                path: 'onboarding',
                loadChildren: () =>
                    import(
                        'app/modules/restaurant/onboarding/onboarding.routes'
                    ),
            },
        ],
    },

    // Storefront area — public, restaurant-facing. Browsable by guests; a
    // valid session is restored when present. The area drives the chrome
    // (enterprise layout + storefront nav) regardless of the viewer's role.
    {
        path: '',
        canActivate: [OptionalAuthGuard],
        canActivateChild: [OptionalAuthGuard],
        component: LayoutComponent,
        data: {
            area: 'storefront',
            layout: 'enterprise',
            theme: 'theme-default',
        },
        resolve: {
            initialData: initialDataResolver,
        },
        children: [
            {
                path: 'home',
                loadChildren: () => import('app/modules/home/home.routes'),
            },
            {
                path: 'profile',
                loadChildren: () =>
                    import('app/modules/restaurant/profile.routes'),
            },
            {
                path: 'settings',
                loadChildren: () =>
                    import('app/modules/restaurant/settings/settings.routes'),
            },
            {
                path: 'invoices',
                loadChildren: () =>
                    import('app/modules/restaurant/invoices/invoices.routes'),
            },
            {
                path: 'wishlist',
                loadChildren: () =>
                    import('app/modules/wishlist/wishlist.routes'),
            },
            {
                path: 'cart',
                loadChildren: () => import('app/modules/cart/cart.routes'),
            },
            {
                path: 'checkout',
                loadComponent: () =>
                    import('app/modules/cart/checkout.component').then(
                        (m) => m.CheckoutComponent
                    ),
            },
            { path: 'booking', pathMatch: 'full', redirectTo: 'cart' },
            // Storefront stub pages (nav "Tìm hiểu FreshFlow" + Hot Deals)
            {
                path: 'about',
                loadComponent: () =>
                    import('app/modules/pages/placeholder-page.component').then(
                        (m) => m.PlaceholderPageComponent
                    ),
                data: { title: 'Về chúng tôi' },
            },
            {
                path: 'faq',
                loadComponent: () =>
                    import('app/modules/pages/placeholder-page.component').then(
                        (m) => m.PlaceholderPageComponent
                    ),
                data: { title: 'Câu hỏi thường gặp' },
            },
            {
                path: 'contact',
                loadComponent: () =>
                    import('app/modules/pages/placeholder-page.component').then(
                        (m) => m.PlaceholderPageComponent
                    ),
                data: { title: 'Liên hệ' },
            },
            // No `deals` route: hot deals are the catalog filtered to the
            // market's featured listings (`/catalog?featured=1`), not a page
            // of their own.
            // Order management area (header "Theo dõi đơn hàng").
            {
                path: 'orders',
                loadChildren: () => import('app/modules/orders/orders.routes'),
            },
            {
                path: 'catalog',
                loadChildren: () =>
                    import('app/modules/catalog/catalog.routes'),
            },
        ],
    },

    // Admin console area — admin role only (dense layout + admin nav).
    {
        path: '',
        canActivate: [adminOnly],
        canActivateChild: [adminOnly],
        component: LayoutComponent,
        // The console shares the storefront palette for now. To give it its own
        // brand, add a theme to `themes` in tailwind.config.js and point this
        // `theme` at it — no other change needed (LayoutComponent applies the
        // class per area). Deliberately NOT a byte-identical second theme:
        // that would emit ~148 KB of duplicate CSS for zero visual difference.
        data: {
            area: 'admin',
            layout: 'dense',
            theme: 'theme-default',
        },
        resolve: {
            initialData: initialDataResolver,
        },
        children: [
            {
                path: 'admin',
                loadChildren: () => import('app/modules/admin/admin.routes'),
            },
        ],
    },

    // Error pages — reachable regardless of auth state (a mistyped URL can
    // come from a guest or a signed-in user); `**` must stay last so it
    // never shadows a route from an earlier group.
    {
        path: '',
        canActivate: [OptionalAuthGuard],
        canActivateChild: [OptionalAuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty',
        },
        children: [
            { path: '500', component: Error500Component },
            { path: '404', component: Error404Component },
            { path: '**', redirectTo: '404' },
        ],
    },
];
