import { FuseNavigationItem } from '@fuse/components/navigation';
import { ConsoleMode } from 'app/core/navigation/console-mode.service';
import { Area } from 'app/core/navigation/navigation.types';
import { UserRole } from 'app/core/user/user.types';

/**
 * A navigation item annotated with the area it belongs to and, optionally,
 * the roles allowed to see it. No `roles` = every viewer of the area sees
 * it, including guests (the storefront is public).
 *
 * `modes` narrows an admin-console item to one job (see `ConsoleMode`);
 * no `modes` = shown in both jobs.
 */
interface AreaNavItem extends FuseNavigationItem {
    area: Area;
    roles?: UserRole[];
    modes?: ConsoleMode[];
}

/**
 * Single source of navigation, grouped by area. The nav reflects WHERE the
 * user is (the route's area), not who they are; roles only gate access
 * (`roleGuard`) and add cross-area entries such as the admin console link.
 */
const NAVIGATION: AreaNavItem[] = [
    // Storefront — public, restaurant-facing
    {
        id: 'home',
        title: 'nav.home',
        type: 'basic',
        icon: 'heroicons_outline:home',
        link: '/home',
        area: 'storefront',
    },
    {
        id: 'shopping',
        title: 'nav.shopping',
        type: 'basic',
        icon: 'heroicons_outline:shopping-bag',
        link: '/catalog',
        area: 'storefront',
    },
    {
        id: 'learn',
        title: 'nav.learn',
        type: 'collapsable',
        icon: 'heroicons_outline:information-circle',
        area: 'storefront',
        children: [
            {
                id: 'learn.about',
                title: 'nav.learn.about',
                type: 'basic',
                link: '/about',
            },
            {
                id: 'learn.faq',
                title: 'nav.learn.faq',
                type: 'basic',
                link: '/faq',
            },
            {
                id: 'learn.contact',
                title: 'nav.learn.contact',
                type: 'basic',
                link: '/contact',
            },
        ],
    },
    // Cross-area entry: admins browsing the storefront can reach the console
    {
        id: 'admin',
        title: 'nav.admin',
        type: 'basic',
        icon: 'heroicons_outline:wrench-screwdriver',
        link: '/admin',
        area: 'storefront',
        roles: ['admin'],
    },

    // Admin console — Dashboard + collapsable domain trees. Children use the
    // tree connector style (no icons).
    //
    // Order follows the operational day (phiên chợ → gom đơn → cuốc giao hàng),
    // then the reference data behind it. Recurring work sits above configuration
    // that is touched once in a while; creating a record is a primary button on
    // the list screen, not a nav entry.
    //
    // `modes` splits the console by job: the daily dispatch work belongs to
    // `operations` (orders, restaurants, network, finance), account/system
    // administration and hàng hóa to `administration`.
    {
        id: 'admin-dashboard',
        title: 'nav.admin.dashboard',
        type: 'basic',
        icon: 'heroicons_outline:home',
        link: '/admin',
        // /admin is a prefix of /admin/users|products — exact only
        exactMatch: true,
        area: 'admin',
    },
    {
        id: 'admin.operations',
        title: 'nav.admin.operations',
        type: 'collapsable',
        icon: 'heroicons_outline:clipboard-document-list',
        area: 'admin',
        modes: ['operations'],
        children: [
            {
                id: 'admin-order-groups',
                title: 'nav.admin.orderGroups',
                type: 'basic',
                link: '/admin/order-groups',
            },
            {
                id: 'admin-orders',
                title: 'nav.admin.orders',
                type: 'basic',
                link: '/admin/orders',
            },
            {
                id: 'admin-routes',
                title: 'nav.admin.routes',
                type: 'basic',
                link: '/admin/routes',
            },
            {
                id: 'admin-restaurants',
                title: 'nav.admin.restaurants',
                type: 'basic',
                link: '/admin/restaurants',
            },
        ],
    },
    {
        id: 'admin.finance',
        title: 'nav.admin.finance',
        type: 'collapsable',
        icon: 'heroicons_outline:banknotes',
        area: 'admin',
        modes: ['operations'],
        children: [
            {
                id: 'admin-finance-overview',
                title: 'nav.admin.financeOverview',
                type: 'basic',
                link: '/admin/finance',
            },
            {
                id: 'admin-finance-invoices',
                title: 'nav.admin.invoices',
                type: 'basic',
                link: '/admin/invoices',
            },
            {
                id: 'admin-finance-claims',
                title: 'nav.admin.claims',
                type: 'basic',
                link: '/admin/claims',
            },
        ],
    },
    {
        id: 'admin.accounts',
        title: 'nav.admin.accounts',
        type: 'collapsable',
        icon: 'heroicons_outline:users',
        area: 'admin',
        modes: ['administration'],
        children: [
            {
                id: 'admin-users',
                title: 'nav.admin.users',
                type: 'basic',
                link: '/admin/users',
            },
        ],
    },
    {
        id: 'admin.goods',
        title: 'nav.admin.goods',
        type: 'collapsable',
        icon: 'heroicons_outline:cube',
        area: 'admin',
        modes: ['administration'],
        children: [
            {
                id: 'admin-products',
                title: 'nav.admin.products',
                type: 'basic',
                link: '/admin/products',
            },
            {
                id: 'admin-categories',
                title: 'nav.admin.categories',
                type: 'basic',
                link: '/admin/categories',
            },
            {
                id: 'admin-units',
                title: 'nav.admin.units',
                type: 'basic',
                link: '/admin/units',
            },
            {
                id: 'admin-packing-codes',
                title: 'nav.admin.packingCodes',
                type: 'basic',
                link: '/admin/packing-codes',
            },
        ],
    },
    {
        id: 'admin.network',
        title: 'nav.admin.network',
        type: 'collapsable',
        icon: 'heroicons_outline:map',
        area: 'admin',
        modes: ['operations'],
        children: [
            {
                id: 'admin-markets',
                title: 'nav.admin.markets',
                type: 'basic',
                link: '/admin/markets',
            },
            {
                id: 'admin-hubs',
                title: 'nav.admin.hubs',
                type: 'basic',
                link: '/admin/hubs',
            },
            {
                id: 'admin-vehicles',
                title: 'nav.admin.vehicles',
                type: 'basic',
                link: '/admin/vehicles',
            },
        ],
    },
    {
        id: 'admin.system',
        title: 'nav.admin.system',
        type: 'collapsable',
        icon: 'heroicons_outline:cog-6-tooth',
        area: 'admin',
        modes: ['administration'],
        children: [
            {
                id: 'admin-order-group-settings',
                title: 'nav.admin.orderGroupSettings',
                type: 'basic',
                link: '/admin/order-group-settings',
            },
            {
                id: 'admin-audit-logs',
                title: 'nav.admin.auditLogs',
                type: 'basic',
                link: '/admin/audit-logs',
            },
        ],
    },
    {
        id: 'admin.links',
        title: 'nav.admin.links',
        type: 'group',
        area: 'admin',
        children: [
            {
                id: 'admin-view-store',
                title: 'nav.admin.viewStore',
                type: 'basic',
                icon: 'heroicons_outline:shopping-bag',
                link: '/home',
            },
        ],
    },
];

/**
 * Build the Fuse navigation items for `area`, filtered by `role` and — inside
 * the admin console — by the active `mode`. Role-restricted items are hidden
 * from guests (`role === null`); `mode` is ignored outside the admin console
 * since no storefront item declares one.
 */
export function buildNavigation(
    area: Area,
    role: UserRole | null,
    mode: ConsoleMode
): FuseNavigationItem[] {
    return NAVIGATION.filter((item) => item.area === area)
        .filter(
            (item) =>
                !item.roles || (role !== null && item.roles.includes(role))
        )
        .filter((item) => !item.modes || item.modes.includes(mode))
        .map(({ area: _area, roles: _roles, modes: _modes, ...item }) => item);
}
