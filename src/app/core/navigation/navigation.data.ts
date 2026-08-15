import { FuseNavigationItem } from '@fuse/components/navigation';
import { Area } from 'app/core/navigation/navigation.types';
import { UserRole } from 'app/core/user/user.types';

/**
 * A navigation item annotated with the area it belongs to and, optionally,
 * the roles allowed to see it. No `roles` = every viewer of the area sees
 * it, including guests (the storefront is public).
 */
interface AreaNavItem extends FuseNavigationItem {
    area: Area;
    roles?: UserRole[];
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

    // Admin console — five domain trees, one per thing the console is about:
    // dashboard, the market session, chợ, hàng hóa, tài khoản. Children use the
    // tree connector style (no icons).
    //
    // The console no longer splits by job (vận hành ↔ quản trị): every section
    // is on one nav at all times.
    //
    // Screens marked "chưa gộp" below are staged here because the config tabs
    // that will absorb them (session detail, market config, product config) do
    // not exist yet. They come out of the nav as each set of tabs lands —
    // leaving them out now would only make working screens unreachable.
    {
        id: 'admin.dashboard',
        title: 'nav.admin.dashboard',
        type: 'collapsable',
        icon: 'heroicons_outline:home',
        area: 'admin',
        children: [
            {
                id: 'admin-finance',
                title: 'nav.admin.finance',
                type: 'basic',
                link: '/admin/finance',
            },
            {
                id: 'admin-claims',
                title: 'nav.admin.claims',
                type: 'basic',
                link: '/admin/claims',
            },
            {
                id: 'admin-analysis',
                title: 'nav.admin.analysis',
                type: 'basic',
                link: '/admin',
                // /admin prefixes every console route — exact only
                exactMatch: true,
            },
        ],
    },
    {
        id: 'admin.sessions',
        title: 'nav.admin.sessions',
        type: 'collapsable',
        icon: 'heroicons_outline:clipboard-document-list',
        area: 'admin',
        children: [
            {
                id: 'admin-order-groups',
                title: 'nav.admin.sessionCreate',
                type: 'basic',
                link: '/admin/order-groups',
                exactMatch: true,
            },
            {
                id: 'admin-order-group-history',
                title: 'nav.admin.orderGroupHistory',
                type: 'basic',
                link: '/admin/order-groups/history',
            },
            {
                id: 'admin-scheduled-orders',
                title: 'nav.admin.scheduledOrders',
                type: 'basic',
                link: '/admin/scheduled-orders',
            },
            {
                id: 'admin-order-group-settings',
                title: 'nav.admin.orderGroupSettings',
                type: 'basic',
                link: '/admin/order-group-settings',
            },
        ],
    },
    // Chợ / sản phẩm / người dùng go straight to their list. Creating one is a
    // primary button on that list, not a second nav row: the nav says where you
    // are, and "Tạo X" is an action, not a place.
    //
    // No `exactMatch`: the detail and create routes sit under these paths, so
    // the section stays lit while you are inside one of its records.
    {
        id: 'admin-markets',
        title: 'nav.admin.markets',
        type: 'basic',
        icon: 'heroicons_outline:building-storefront',
        link: '/admin/markets',
        area: 'admin',
    },
    // Sản phẩm only opens its branch — the list is the first child, so the
    // parent stays a heading over the reference data behind it (categories,
    // units, packing codes, tags — the "chưa gộp" set, until the product config
    // tabs absorb them).
    {
        id: 'admin.products',
        title: 'nav.admin.products',
        type: 'collapsable',
        icon: 'heroicons_outline:cube',
        area: 'admin',
        children: [
            {
                id: 'admin-products-all',
                title: 'nav.admin.productsAll',
                type: 'basic',
                link: '/admin/products',
                exactMatch: true,
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
            {
                id: 'admin-tags',
                title: 'nav.admin.tags',
                type: 'basic',
                link: '/admin/tags',
            },
        ],
    },
    {
        id: 'admin-users',
        title: 'nav.admin.users',
        type: 'basic',
        icon: 'heroicons_outline:users',
        link: '/admin/users',
        area: 'admin',
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
 * Build the Fuse navigation items for `area`, filtered by `role`.
 * Role-restricted items are hidden from guests (`role === null`).
 */
export function buildNavigation(
    area: Area,
    role: UserRole | null
): FuseNavigationItem[] {
    return NAVIGATION.filter((item) => item.area === area)
        .filter(
            (item) =>
                !item.roles || (role !== null && item.roles.includes(role))
        )
        .map(({ area: _area, roles: _roles, ...item }) => item);
}
