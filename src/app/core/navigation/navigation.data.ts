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
    //
    // Order follows the operational day (phiên chợ → gom đơn → cuốc giao hàng),
    // then the reference data behind it. Recurring work sits above configuration
    // that is touched once in a while; creating a record is a primary button on
    // the list screen, not a nav entry.
    //
    // `modes` splits the console by job: the daily dispatch work belongs to
    // `operations`, account/finance/system administration to `administration`,
    // and the shared master data (hàng hóa, mạng lưới) shows in both.
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
        id: 'admin.operations',
        title: 'Vận hành',
        type: 'collapsable',
        icon: 'heroicons_outline:clipboard-document-list',
        area: 'admin',
        modes: ['operations'],
        children: [
            {
                id: 'admin-order-groups',
                title: 'Phiên chợ & gom đơn',
                type: 'basic',
                link: '/admin/order-groups',
            },
            {
                id: 'admin-orders',
                title: 'Đơn hàng',
                type: 'basic',
                link: '/admin/orders',
            },
            {
                id: 'admin-routes',
                title: 'Cuốc giao hàng',
                type: 'basic',
                link: '/admin/routes',
            },
        ],
    },
    {
        id: 'admin.accounts',
        title: 'Người dùng & nhà hàng',
        type: 'collapsable',
        icon: 'heroicons_outline:users',
        area: 'admin',
        modes: ['administration'],
        children: [
            {
                id: 'admin-users',
                title: 'Người dùng',
                type: 'basic',
                link: '/admin/users',
            },
            {
                id: 'admin-restaurants',
                title: 'Nhà hàng',
                type: 'basic',
                link: '/admin/restaurants',
            },
        ],
    },
    {
        id: 'admin.goods',
        title: 'Hàng hóa',
        type: 'collapsable',
        icon: 'heroicons_outline:cube',
        area: 'admin',
        children: [
            {
                id: 'admin-products',
                title: 'Sản phẩm',
                type: 'basic',
                link: '/admin/products',
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
        id: 'admin.network',
        title: 'Mạng lưới',
        type: 'collapsable',
        icon: 'heroicons_outline:map',
        area: 'admin',
        children: [
            {
                id: 'admin-markets',
                title: 'Chợ đầu mối',
                type: 'basic',
                link: '/admin/markets',
            },
            {
                id: 'admin-hubs',
                title: 'Hub',
                type: 'basic',
                link: '/admin/hubs',
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
        id: 'admin-invoices',
        title: 'Hóa đơn',
        type: 'basic',
        icon: 'heroicons_outline:banknotes',
        link: '/admin/invoices',
        area: 'admin',
        modes: ['administration'],
    },
    {
        id: 'admin.system',
        title: 'Hệ thống',
        type: 'collapsable',
        icon: 'heroicons_outline:cog-6-tooth',
        area: 'admin',
        modes: ['administration'],
        children: [
            {
                id: 'admin-order-group-settings',
                title: 'Cấu hình phiên chợ',
                type: 'basic',
                link: '/admin/order-group-settings',
            },
            {
                id: 'admin-audit-logs',
                title: 'Nhật ký hệ thống',
                type: 'basic',
                link: '/admin/audit-logs',
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
