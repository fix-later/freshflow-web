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
        title: 'Trang chủ',
        type: 'basic',
        icon: 'heroicons_outline:home',
        link: '/home',
        area: 'storefront',
    },
    {
        id: 'shopping',
        title: 'Mua sắm',
        type: 'basic',
        icon: 'heroicons_outline:shopping-bag',
        link: '/catalog',
        area: 'storefront',
    },
    {
        id: 'profile',
        title: 'Hồ sơ nhà hàng',
        type: 'basic',
        icon: 'heroicons_outline:building-storefront',
        link: '/profile',
        area: 'storefront',
        roles: ['restaurant'],
    },
    {
        id: 'learn',
        title: 'Tìm hiểu FreshFlow',
        type: 'collapsable',
        icon: 'heroicons_outline:information-circle',
        area: 'storefront',
        children: [
            {
                id: 'learn.about',
                title: 'Về chúng tôi',
                type: 'basic',
                link: '/about',
            },
            {
                id: 'learn.faq',
                title: 'FAQ',
                type: 'basic',
                link: '/faq',
            },
            {
                id: 'learn.contact',
                title: 'Liên hệ',
                type: 'basic',
                link: '/contact',
            },
        ],
    },
    // Cross-area entry: admins browsing the storefront can reach the console
    {
        id: 'admin',
        title: 'Quản trị',
        type: 'basic',
        icon: 'heroicons_outline:wrench-screwdriver',
        link: '/admin',
        area: 'storefront',
        roles: ['admin'],
    },

    // Admin console — group headers + ordered children (Fuse vertical nav
    // renders sections in array order, like Dashboards / Applications).
    {
        id: 'admin.dashboards',
        title: 'Tổng quan',
        type: 'group',
        area: 'admin',
        children: [
            {
                id: 'admin-dashboard',
                title: 'Dashboard',
                type: 'basic',
                icon: 'heroicons_outline:chart-pie',
                link: '/admin',
                // /admin is a prefix of /admin/users|restaurants — exact only
                exactMatch: true,
            },
        ],
    },
    {
        id: 'admin.management',
        title: 'Quản lý',
        type: 'group',
        area: 'admin',
        children: [
            {
                id: 'admin-users',
                title: 'Người dùng',
                type: 'basic',
                icon: 'heroicons_outline:users',
                link: '/admin/users',
            },
            {
                id: 'admin-restaurants',
                title: 'Nhà hàng',
                type: 'basic',
                icon: 'heroicons_outline:building-storefront',
                link: '/admin/restaurants',
            },
        ],
    },
    {
        id: 'admin.operations',
        title: 'Vận hành',
        type: 'group',
        area: 'admin',
        children: [
            {
                id: 'admin-order-groups',
                title: 'Gom đơn',
                type: 'basic',
                icon: 'heroicons_outline:rectangle-group',
                link: '/admin/order-groups',
            },
        ],
    },
    {
        id: 'admin.catalog',
        title: 'Danh mục',
        type: 'group',
        area: 'admin',
        children: [
            {
                id: 'admin-categories',
                title: 'Danh mục sản phẩm',
                type: 'basic',
                icon: 'heroicons_outline:tag',
                link: '/admin/categories',
            },
            {
                id: 'admin-units',
                title: 'Đơn vị tính',
                type: 'basic',
                icon: 'heroicons_outline:scale',
                link: '/admin/units',
            },
            {
                id: 'admin-products',
                title: 'Sản phẩm',
                type: 'basic',
                icon: 'heroicons_outline:cube',
                link: '/admin/products',
            },
            {
                id: 'admin-markets',
                title: 'Chợ đầu mối',
                type: 'basic',
                icon: 'heroicons_outline:building-storefront',
                link: '/admin/markets',
            },
        ],
    },
    {
        id: 'admin.logistics',
        title: 'Giao vận',
        type: 'group',
        area: 'admin',
        children: [
            {
                id: 'admin-hubs',
                title: 'Hub',
                type: 'basic',
                icon: 'heroicons_outline:building-office-2',
                link: '/admin/hubs',
            },
            {
                id: 'admin-vehicles',
                title: 'Phương tiện',
                type: 'basic',
                icon: 'heroicons_outline:truck',
                link: '/admin/vehicles',
            },
            {
                id: 'admin-zones',
                title: 'Vùng giao hàng',
                type: 'basic',
                icon: 'heroicons_outline:map-pin',
                link: '/admin/delivery-zones',
            },
        ],
    },
    {
        id: 'admin.links',
        title: 'Liên kết',
        type: 'group',
        area: 'admin',
        children: [
            {
                id: 'admin-view-store',
                title: 'Xem cửa hàng',
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
