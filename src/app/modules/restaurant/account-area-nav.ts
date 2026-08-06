/** One entry in an `account-shell` sidebar group. */
export interface AccountShellNavItem {
    id: string;
    link: string;
    labelKey: string;
    icon: string;
}

/** A titled block of related destinations. */
export interface AccountNavGroup {
    id: string;
    labelKey: string;
    items: readonly AccountShellNavItem[];
}

/**
 * Every destination in the restaurant's account area, grouped.
 *
 * The same list renders in the `account-shell` right rail on all of its pages
 * and in the header account menu. Favourites and the cart stay out of this
 * rail — both already have their own icon in the header.
 *
 * Links point at concrete child paths so `routerLinkActive` can mark exactly
 * one item; the sole exception is the profile landing, whose section is the
 * route layer's decision (see `profile.routes.ts`).
 */
const ACCOUNT_GROUPS: readonly AccountNavGroup[] = [
    {
        id: 'account',
        labelKey: 'accountShell.group',
        items: [
            {
                id: 'dashboard',
                link: '/profile/dashboard',
                labelKey: 'restaurantProfile.tabs.dashboard',
                icon: 'heroicons_outline:squares-2x2',
            },
            {
                id: 'account',
                link: '/profile/account',
                labelKey: 'restaurantProfile.tabs.account',
                icon: 'heroicons_outline:user-circle',
            },
            {
                id: 'settings',
                link: '/settings',
                labelKey: 'user.settings',
                icon: 'heroicons_outline:cog-6-tooth',
            },
        ],
    },
    {
        id: 'restaurant',
        labelKey: 'accountShell.groups.restaurant',
        items: [
            {
                id: 'business',
                link: '/profile/business',
                labelKey: 'restaurantProfile.profile.sectionTitle',
                icon: 'heroicons_outline:building-storefront',
            },
            {
                id: 'tax',
                link: '/profile/tax',
                labelKey: 'restaurantProfile.taxProfile.sectionTitle',
                icon: 'heroicons_outline:document-text',
            },
            {
                id: 'addresses',
                link: '/profile/addresses',
                labelKey: 'restaurantProfile.deliveryAddresses.sectionTitle',
                icon: 'heroicons_outline:map-pin',
            },
        ],
    },
    {
        id: 'shopping',
        labelKey: 'accountShell.groups.shopping',
        items: [
            {
                id: 'orders',
                link: '/orders',
                labelKey: 'restaurantProfile.tabs.orders',
                icon: 'heroicons_outline:clipboard-document-list',
            },
            {
                id: 'scheduled',
                link: '/profile/scheduled',
                labelKey: 'scheduledOrders.title',
                icon: 'heroicons_outline:arrow-path',
            },
            // Filed from the order they are about; listed here because a claim
            // outlives the order screen — it is decided by admin/ops later, and
            // the outcome has to be findable without hunting for the order.
            {
                id: 'claims',
                link: '/profile/claims',
                labelKey: 'claims.title',
                icon: 'heroicons_outline:chat-bubble-left-right',
            },
        ],
    },
    {
        id: 'billing',
        labelKey: 'accountShell.groups.billing',
        items: [
            {
                id: 'credit',
                link: '/profile/credit',
                labelKey: 'restaurantCredit.title',
                icon: 'heroicons_outline:banknotes',
            },
            {
                id: 'invoices',
                link: '/profile/invoices',
                labelKey: 'restaurantProfile.tabs.invoices',
                icon: 'heroicons_outline:receipt-percent',
            },
        ],
    },
];

/**
 * The groups the signed-in role can actually reach.
 *
 * Everything outside the account group is restaurant-owned — the profile
 * sections are behind `restaurantSectionGuard`, `/orders` behind a
 * `roleGuard`. Linking another role there would only bounce them, so those
 * groups are dropped, and the restaurant-only overview goes with them.
 */
export function accountNavGroups(
    isRestaurant: boolean
): readonly AccountNavGroup[] {
    if (isRestaurant) {
        return ACCOUNT_GROUPS;
    }
    return [
        {
            ...ACCOUNT_GROUPS[0],
            items: ACCOUNT_GROUPS[0].items.filter(
                (item) => item.id !== 'dashboard'
            ),
        },
    ];
}

/** The same destinations flattened, for surfaces without group headings. */
export function accountNavItems(
    isRestaurant: boolean
): readonly AccountShellNavItem[] {
    return accountNavGroups(isRestaurant).flatMap((group) => group.items);
}

/**
 * The handful of destinations the header account menu offers.
 *
 * A dropdown is a shortcut list, not a second copy of the rail: reproducing
 * all twelve made it taller than most of the pages it links to. These are the
 * ones worth a jump from anywhere —
 *
 * - `dashboard` is the way *into* the area, where the rail then covers the rest;
 * - `orders`, `credit` and `invoices` are what a buyer checks between orders;
 * - `settings` is where people expect it, at the bottom of an account menu.
 *
 * Favourites and the cart are left out on purpose: both already have their own
 * icon in the same header, a step away from this button.
 */
const MENU_IDS: readonly string[] = [
    'dashboard',
    'account',
    'orders',
    'credit',
    'invoices',
    'settings',
];

/**
 * Menu order follows {@link MENU_IDS}, not the rail's grouping.
 *
 * `dashboard` and `account` are both listed because a role that cannot reach
 * the overview still needs a way into its profile — but only one of them ever
 * renders, so the menu never offers two doors to the same place.
 */
export function accountMenuItems(
    isRestaurant: boolean
): readonly AccountShellNavItem[] {
    const byId = new Map(
        accountNavItems(isRestaurant).map((item) => [item.id, item])
    );
    const items = MENU_IDS.map((id) => byId.get(id)).filter(
        (item): item is AccountShellNavItem => !!item
    );
    return items.some((item) => item.id === 'dashboard')
        ? items.filter((item) => item.id !== 'account')
        : items;
}
