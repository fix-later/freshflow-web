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

    // Admin console — Dashboard + collapsable domain trees. Children use the
    // tree connector style (no icons).
    // Main entities: Thêm (/new) + Tất cả. Config children: one list link each
    // (create/edit/delete lives on that page).
    {
        id: 'admin-dashboard',
        title: 'Dashboard',
        type: 'basic',
        icon: 'heroicons_outline:home',
        link: '/admin',
        // /admin is a prefix of /admin/users|products — exact only
        exactMatch: true,
        area: 'admin',
    },
    {
        id: 'admin.users',
        title: 'Người dùng',
        type: 'collapsable',
        icon: 'heroicons_outline:users',
        area: 'admin',
        children: [
            {
                id: 'admin-users-add',
                title: 'Thêm người dùng',
                type: 'basic',
                link: '/admin/users/new',
            },
            {
                id: 'admin-users-all',
                title: 'Tất cả người dùng',
                type: 'basic',
                link: '/admin/users',
                exactMatch: true,
            },
        ],
    },
    {
        id: 'admin.restaurants',
        title: 'Nhà hàng',
        type: 'collapsable',
        icon: 'heroicons_outline:building-office-2',
        area: 'admin',
        children: [
            {
                id: 'admin-restaurants-add',
                title: 'Thêm nhà hàng',
                type: 'basic',
                link: '/admin/restaurants/new',
            },
            {
                id: 'admin-restaurants-all',
                title: 'Tất cả nhà hàng',
                type: 'basic',
                link: '/admin/restaurants',
                exactMatch: true,
            },
            {
                id: 'admin-invoices',
                title: 'Hóa đơn',
                type: 'basic',
                link: '/admin/invoices',
            },
        ],
    },
    {
        id: 'admin.markets',
        title: 'Chợ đầu mối',
        type: 'collapsable',
        icon: 'heroicons_outline:building-storefront',
        area: 'admin',
        children: [
            {
                id: 'admin-markets-add',
                title: 'Thêm chợ đầu mối',
                type: 'basic',
                link: '/admin/markets/new',
            },
            {
                id: 'admin-markets-all',
                title: 'Tất cả chợ đầu mối',
                type: 'basic',
                link: '/admin/markets',
                exactMatch: true,
            },
            {
                id: 'admin-market-products',
                title: 'Sản phẩm',
                type: 'basic',
                link: '/admin/products',
                exactMatch: true,
            },
            {
                id: 'admin-categories',
                title: 'Danh mục',
                type: 'basic',
                link: '/admin/categories',
            },
            {
                id: 'admin-units',
                title: 'Đơn vị tính',
                type: 'basic',
                link: '/admin/units',
            },
            {
                id: 'admin-packing-codes',
                title: 'Mã đóng gói',
                type: 'basic',
                link: '/admin/packing-codes',
            },
        ],
    },
    {
        id: 'admin.operations',
        title: 'Đơn hàng phiên chợ',
        type: 'collapsable',
        icon: 'heroicons_outline:rectangle-group',
        area: 'admin',
        children: [
            {
                id: 'admin-order-groups',
                title: 'Danh sách phiên',
                type: 'basic',
                link: '/admin/order-groups',
            },
            {
                id: 'admin-orders',
                title: 'Danh sách đơn',
                type: 'basic',
                link: '/admin/orders',
            },
            {
                id: 'admin-order-group-settings',
                title: 'Cấu hình phiên chợ',
                type: 'basic',
                link: '/admin/order-group-settings',
            },
        ],
    },
    {
        id: 'admin.logistics',
        title: 'Giao vận',
        type: 'collapsable',
        icon: 'heroicons_outline:truck',
        area: 'admin',
        children: [
            {
                id: 'admin-hubs',
                title: 'Hub',
                type: 'basic',
                link: '/admin/hubs',
            },
            {
                id: 'admin-routes',
                title: 'Tuyến đường',
                type: 'basic',
                link: '/admin/routes',
            },
            {
                id: 'admin-vehicles',
                title: 'Phương tiện',
                type: 'basic',
                link: '/admin/vehicles',
            },
            {
                id: 'admin-zones',
                title: 'Vùng giao hàng',
                type: 'basic',
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
