import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthGuard } from 'app/core/auth/guards/auth.guard';
import { UserService } from 'app/core/user/user.service';
import { AccountInfoComponent } from './account-info/account-info.component';
import { BusinessProfileFormComponent } from './business-profile/business-profile-form.component';
import { ClaimsListComponent } from './claims/claims-list.component';
import { CreditComponent } from './credit/credit.component';
import { RestaurantDashboardComponent } from './dashboard/restaurant-dashboard.component';
import { DeliveryAddressesComponent } from './delivery-addresses/delivery-addresses.component';
import { InvoicesListComponent } from './invoices/invoices-list.component';
import { ProfileComponent } from './profile.component';
import { ScheduledOrdersComponent } from './scheduled-orders/scheduled-orders.component';
import { TaxProfileFormComponent } from './tax-profile/tax-profile-form.component';

/** Restaurant-only profile sections; other roles stay on `/profile/account`. */
const restaurantSectionGuard: CanActivateFn = () => {
    const role = inject(UserService).current?.role;
    if (role === 'restaurant') {
        return true;
    }
    return inject(Router).createUrlTree(['/profile', 'account']);
};

/**
 * Own-profile area (`/profile`, M2). Child paths mirror the restaurant-profile
 * API surface so each screen is a shareable route:
 *
 * | Route                 | API |
 * |-----------------------|-----|
 * | `/profile/dashboard`  | `GET .../approval-status` (+ credit overview) |
 * | `/profile/business`   | `GET/PUT .../profile` + license upload-signature |
 * | `/profile/tax`        | `PUT .../tax-profile` |
 * | `/profile/addresses`  | `GET/POST/PUT/DELETE .../delivery-addresses` |
 * | `/profile/account`    | `GET/PUT /profile/me` (personal account) |
 */
export default [
    {
        path: '',
        canActivate: [AuthGuard],
        component: ProfileComponent,
        children: [
            // Static redirect on purpose: `redirectTo` is resolved during URL
            // recognition, i.e. BEFORE `AuthGuard` has loaded `/profile/me`, so
            // a role-based redirect here would always see a null user on a cold
            // load. `restaurantSectionGuard` runs after the parent guard and
            // bounces non-restaurant roles on to `/profile/account`.
            { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
            {
                path: 'dashboard',
                canActivate: [restaurantSectionGuard],
                component: RestaurantDashboardComponent,
            },
            {
                path: 'business',
                canActivate: [restaurantSectionGuard],
                component: BusinessProfileFormComponent,
            },
            {
                path: 'tax',
                canActivate: [restaurantSectionGuard],
                component: TaxProfileFormComponent,
            },
            {
                path: 'addresses',
                canActivate: [restaurantSectionGuard],
                component: DeliveryAddressesComponent,
            },
            {
                path: 'credit',
                canActivate: [restaurantSectionGuard],
                component: CreditComponent,
            },
            {
                path: 'scheduled',
                canActivate: [restaurantSectionGuard],
                component: ScheduledOrdersComponent,
            },
            {
                path: 'invoices',
                canActivate: [restaurantSectionGuard],
                component: InvoicesListComponent,
            },
            {
                path: 'claims',
                canActivate: [restaurantSectionGuard],
                component: ClaimsListComponent,
            },
            {
                path: 'account',
                component: AccountInfoComponent,
            },
        ],
    },
] as Routes;
