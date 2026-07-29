import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    computed,
    effect,
    inject,
    signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { UserService } from 'app/core/user/user.service';
import { OrdersListComponent } from 'app/modules/orders/orders-list.component';
import { AccountInfoComponent } from './account-info/account-info.component';
import { BusinessProfileFormComponent } from './business-profile/business-profile-form.component';
import { CreditComponent } from './credit/credit.component';
import { DeliveryAddressesComponent } from './delivery-addresses/delivery-addresses.component';
import { InvoicesListComponent } from './invoices/invoices-list.component';
import { TaxProfileFormComponent } from './tax-profile/tax-profile-form.component';

/**
 * Own-profile area (`/profile`, M2). Reached from the header's account menu.
 * Restaurant users get a full self-service area (business/tax profile,
 * delivery addresses, credit, order history, invoices) as tabs on one page;
 * other roles just see/edit their basic account info.
 */
@Component({
    selector: 'restaurant-profile',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.scss'],
    imports: [
        TranslocoModule,
        MatTabsModule,
        BusinessProfileFormComponent,
        TaxProfileFormComponent,
        DeliveryAddressesComponent,
        CreditComponent,
        OrdersListComponent,
        InvoicesListComponent,
        AccountInfoComponent,
    ],
})
export class ProfileComponent {
    private readonly _userService = inject(UserService);
    private readonly _route = inject(ActivatedRoute);

    private readonly _user = toSignal(this._userService.user$, {
        initialValue: this._userService.current,
    });
    readonly isRestaurant = computed(() => this._user()?.role === 'restaurant');

    private readonly _queryParamMap = toSignal(this._route.queryParamMap);
    /** 0 = detail info, 1 = orders, 2 = invoices — driven by `?tab=`. */
    readonly tabIndex = signal(0);

    constructor() {
        effect(() => {
            const tab = this._queryParamMap()?.get('tab');
            this.tabIndex.set(
                tab === 'orders' ? 1 : tab === 'invoices' ? 2 : 0
            );
        });
    }
}
