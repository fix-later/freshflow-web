import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    computed,
    effect,
    inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
    ActivatedRoute,
    NavigationEnd,
    Router,
    RouterOutlet,
} from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { UserService } from 'app/core/user/user.service';
import { filter, map, startWith } from 'rxjs';
import { AccountShellComponent } from './account-shell/account-shell.component';

/**
 * Restaurant profile sections → child routes under `/profile/*`
 * (see `profile.routes.ts` + RestaurantProfile APIs).
 */
export type ProfileSection =
    | 'dashboard'
    | 'business'
    | 'tax'
    | 'addresses'
    | 'credit'
    | 'scheduled'
    | 'invoices'
    | 'account';

const PROFILE_SECTIONS: readonly ProfileSection[] = [
    'dashboard',
    'business',
    'tax',
    'addresses',
    'credit',
    'scheduled',
    'invoices',
    'account',
] as const;

/**
 * Heading shown for each child section. The nav itself lives in
 * `account-area-nav.ts` — the shell renders one list on every account page,
 * so this component only needs the label for the section it is showing.
 */
const SECTION_LABEL_KEYS: Readonly<Record<ProfileSection, string>> = {
    dashboard: 'restaurantProfile.tabs.dashboard',
    business: 'restaurantProfile.profile.sectionTitle',
    tax: 'restaurantProfile.taxProfile.sectionTitle',
    addresses: 'restaurantProfile.deliveryAddresses.sectionTitle',
    credit: 'restaurantCredit.title',
    scheduled: 'scheduledOrders.title',
    invoices: 'restaurantProfile.tabs.invoices',
    account: 'accountInfo.title',
};

/**
 * Own-profile area (`/profile`) — right sidebar lists RestaurantProfile API
 * sections; child routes host the screens.
 */
@Component({
    selector: 'restaurant-profile',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './profile.component.html',
    host: { class: 'flex w-full min-w-0 flex-auto flex-col' },
    imports: [TranslocoModule, AccountShellComponent, RouterOutlet],
})
export class ProfileComponent {
    private readonly _userService = inject(UserService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);

    private readonly _user = toSignal(this._userService.user$, {
        initialValue: this._userService.current,
    });
    readonly isRestaurant = computed(() => this._user()?.role === 'restaurant');

    private readonly _queryParamMap = toSignal(this._route.queryParamMap, {
        initialValue: this._route.snapshot.queryParamMap,
    });

    /** Active child segment under `/profile/:section`. */
    readonly section = toSignal(
        this._router.events.pipe(
            filter(
                (event): event is NavigationEnd =>
                    event instanceof NavigationEnd
            ),
            startWith(null),
            map(() => this._sectionFromUrl())
        ),
        { initialValue: this._sectionFromUrl() }
    );

    /** Breadcrumb / title leaf for the active section. */
    readonly sectionLabelKey = computed(
        () => SECTION_LABEL_KEYS[this.section()] ?? 'restaurantProfile.title'
    );

    constructor() {
        // Legacy deep links: `/profile?section=business` (and old `tab=`) →
        // `/profile/business`. Orders used to live here — send them to `/orders`.
        // Role gating for sections lives in `profile.routes.ts` guards — do not
        // navigate from an effect (that can cancel the primary navigation).
        effect(() => {
            const params = this._queryParamMap();
            const section = params?.get('section') ?? null;
            const tab = params?.get('tab') ?? null;
            if (!section && !tab) {
                return;
            }
            if (section === 'orders' || tab === 'orders') {
                void this._router.navigateByUrl('/orders', {
                    replaceUrl: true,
                });
                return;
            }
            const target =
                section && this._isSection(section)
                    ? section
                    : tab === 'invoices'
                      ? 'invoices'
                      : null;
            if (!target) {
                return;
            }
            void this._router.navigate(['/profile', target], {
                replaceUrl: true,
                queryParams: { section: null, tab: null },
                queryParamsHandling: 'merge',
            });
        });
    }

    /**
     * The active child segment, read defensively at every level.
     *
     * On a cold load the whole route tree exists before this component is
     * constructed, but on an in-app navigation the child route is activated
     * *after* the parent component — `firstChild.snapshot` is undefined while
     * this runs for the signal's initial value. Reaching into it unguarded
     * threw out of the constructor, which cancelled the navigation and left
     * the user on the page they clicked from. The `NavigationEnd` stream fills
     * in the real section a tick later, so a fallback here costs nothing.
     */
    private _sectionFromUrl(): ProfileSection {
        const leaf = this._route.firstChild?.snapshot?.url?.[0]?.path;
        if (leaf && this._isSection(leaf)) {
            return leaf;
        }
        return this.isRestaurant() ? 'dashboard' : 'account';
    }

    private _isSection(value: string): value is ProfileSection {
        return (PROFILE_SECTIONS as readonly string[]).includes(value);
    }
}
