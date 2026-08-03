import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    OnInit,
    ViewChild,
    ViewEncapsulation,
    computed,
    effect,
    inject,
    signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { ActivatedRoute, Router } from '@angular/router';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { TranslocoModule } from '@jsverse/transloco';
import { UserService } from 'app/core/user/user.service';
import { OrdersListComponent } from 'app/modules/orders/orders-list.component';
import { Subject, takeUntil } from 'rxjs';
import { AccountInfoComponent } from './account-info/account-info.component';
import { BusinessProfileFormComponent } from './business-profile/business-profile-form.component';
import { CreditComponent } from './credit/credit.component';
import { RestaurantDashboardComponent } from './dashboard/restaurant-dashboard.component';
import { DeliveryAddressesComponent } from './delivery-addresses/delivery-addresses.component';
import { InvoicesListComponent } from './invoices/invoices-list.component';
import { ScheduledOrdersComponent } from './scheduled-orders/scheduled-orders.component';
import { TaxProfileFormComponent } from './tax-profile/tax-profile-form.component';

/** Right-sidebar nav keys for restaurant profile (Fuse right-sidebar-3). */
export type ProfileSection =
    | 'dashboard'
    | 'business'
    | 'tax'
    | 'addresses'
    | 'credit'
    | 'orders'
    | 'scheduled'
    | 'invoices'
    | 'account';

interface ProfileNavItem {
    id: ProfileSection;
    icon: string;
    labelKey: string;
    hintKey?: string;
    group: 'profile' | 'billing';
}

/**
 * Own-profile area (`/profile`, M2). Styled after Fuse
 * `ui/page-layouts/simple/right-sidebar-3/normal-scroll`.
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
        MatButtonModule,
        MatIconModule,
        MatSidenavModule,
        BusinessProfileFormComponent,
        TaxProfileFormComponent,
        DeliveryAddressesComponent,
        CreditComponent,
        OrdersListComponent,
        InvoicesListComponent,
        AccountInfoComponent,
        RestaurantDashboardComponent,
        ScheduledOrdersComponent,
    ],
})
export class ProfileComponent implements OnInit, OnDestroy {
    @ViewChild('drawer') drawer: MatDrawer;

    private readonly _userService = inject(UserService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _fuseMediaWatcherService = inject(FuseMediaWatcherService);
    private readonly _unsubscribeAll = new Subject<void>();

    private readonly _user = toSignal(this._userService.user$, {
        initialValue: this._userService.current,
    });
    readonly isRestaurant = computed(() => this._user()?.role === 'restaurant');

    private readonly _queryParamMap = toSignal(this._route.queryParamMap);

    /** Active right-sidebar section. */
    readonly section = signal<ProfileSection>('dashboard');

    /** Drawer: `side` on large screens, `over` on small (Fuse page-layout pattern). */
    readonly drawerMode = signal<'over' | 'side'>('side');
    readonly drawerOpened = signal(true);

    readonly restaurantNav: ReadonlyArray<ProfileNavItem> = [
        {
            id: 'dashboard',
            icon: 'heroicons_outline:squares-2x2',
            labelKey: 'restaurantProfile.tabs.dashboard',
            hintKey: 'restaurantProfile.sidebar.hints.dashboard',
            group: 'profile',
        },
        {
            id: 'business',
            icon: 'heroicons_outline:building-storefront',
            labelKey: 'restaurantProfile.profile.sectionTitle',
            hintKey: 'restaurantProfile.sidebar.hints.business',
            group: 'profile',
        },
        {
            id: 'tax',
            icon: 'heroicons_outline:document-text',
            labelKey: 'restaurantProfile.taxProfile.sectionTitle',
            hintKey: 'restaurantProfile.sidebar.hints.tax',
            group: 'profile',
        },
        {
            id: 'addresses',
            icon: 'heroicons_outline:map-pin',
            labelKey: 'restaurantProfile.deliveryAddresses.sectionTitle',
            hintKey: 'restaurantProfile.sidebar.hints.addresses',
            group: 'profile',
        },
        {
            id: 'credit',
            icon: 'heroicons_outline:banknotes',
            labelKey: 'restaurantCredit.title',
            hintKey: 'restaurantProfile.sidebar.hints.credit',
            group: 'billing',
        },
        {
            id: 'orders',
            icon: 'heroicons_outline:clipboard-document-list',
            labelKey: 'restaurantProfile.tabs.orders',
            hintKey: 'restaurantProfile.sidebar.hints.orders',
            group: 'billing',
        },
        {
            id: 'scheduled',
            icon: 'heroicons_outline:arrow-path',
            labelKey: 'scheduledOrders.title',
            hintKey: 'restaurantProfile.sidebar.hints.scheduled',
            group: 'billing',
        },
        {
            id: 'invoices',
            icon: 'heroicons_outline:receipt-percent',
            labelKey: 'restaurantProfile.tabs.invoices',
            hintKey: 'restaurantProfile.sidebar.hints.invoices',
            group: 'billing',
        },
        {
            id: 'account',
            icon: 'heroicons_outline:user-circle',
            labelKey: 'restaurantProfile.tabs.account',
            hintKey: 'restaurantProfile.sidebar.hints.account',
            // Personal login details sit with the profile group rather than a
            // third heading — the sidebar only has room for two on tablet.
            group: 'profile',
        },
    ];

    /** Breadcrumb leaf label for the active section. */
    readonly sectionLabelKey = computed(() => {
        const id = this.section();
        if (id === 'account') {
            return 'accountInfo.title';
        }
        return (
            this.restaurantNav.find((item) => item.id === id)?.labelKey ??
            'restaurantProfile.title'
        );
    });

    constructor() {
        effect(() => {
            if (!this.isRestaurant()) {
                this.section.set('account');
                return;
            }
            const params = this._queryParamMap();
            const section = params?.get('section');
            const tab = params?.get('tab');
            this.section.set(this._resolveSection(section, tab));
        });
    }

    ngOnInit(): void {
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                if (matchingAliases.includes('lg')) {
                    this.drawerMode.set('side');
                    this.drawerOpened.set(true);
                } else {
                    this.drawerMode.set('over');
                    this.drawerOpened.set(false);
                }
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    selectSection(id: ProfileSection): void {
        this.section.set(id);
        void this._router.navigate([], {
            relativeTo: this._route,
            queryParams: {
                section: id === 'dashboard' ? null : id,
                tab: null,
            },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
        if (this.drawerMode() === 'over') {
            void this.drawer?.close();
        }
    }

    toggleDrawer(): void {
        void this.drawer?.toggle();
    }

    private _resolveSection(
        section: string | null | undefined,
        tab: string | null | undefined
    ): ProfileSection {
        const fromSection = section as ProfileSection | null;
        if (
            fromSection &&
            this.restaurantNav.some((item) => item.id === fromSection)
        ) {
            return fromSection;
        }
        if (tab === 'orders') {
            return 'orders';
        }
        if (tab === 'invoices') {
            return 'invoices';
        }
        // Landing on the overview: the figures a buyer opens this area for.
        return 'dashboard';
    }
}
