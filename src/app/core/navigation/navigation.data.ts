import { FuseNavigationItem } from '@fuse/components/navigation';
import { UserRole } from 'app/core/user/user.types';

/** A navigation item annotated with the roles allowed to see it. */
interface RoleNavItem extends FuseNavigationItem {
    roles: UserRole[];
}

const ALL: UserRole[] = ['restaurant', 'operations_manager', 'admin'];

/** "Soon" badge for modules not yet implemented on the web client. */
const soon = {
    title: 'Soon',
    classes: 'px-2 bg-gray-100 text-gray-500 rounded-full',
};

/**
 * Single source of navigation, annotated by role. Mirrors the role → group
 * table in `specs/ux/NAVIGATION.md`. Modules without a built route yet are
 * `disabled` with a "Soon" badge so role-filtering is visible without 404s.
 */
const NAVIGATION: RoleNavItem[] = [
    {
        id: 'home',
        title: 'Home',
        type: 'basic',
        icon: 'heroicons_outline:home',
        link: '/home',
        roles: ALL,
    },
    {
        id: 'catalog',
        title: 'Catalog & Prices',
        type: 'basic',
        icon: 'heroicons_outline:squares-2x2',
        link: '/catalog',
        roles: ALL,
    },
    {
        id: 'orders',
        title: 'Orders',
        type: 'basic',
        icon: 'heroicons_outline:shopping-cart',
        link: '/orders',
        disabled: true,
        badge: soon,
        roles: ['restaurant', 'admin'],
    },
    {
        id: 'credit',
        title: 'Credit',
        type: 'basic',
        icon: 'heroicons_outline:credit-card',
        link: '/credit',
        disabled: true,
        badge: soon,
        roles: ['restaurant', 'admin'],
    },
    {
        id: 'deliveries',
        title: 'Deliveries',
        type: 'basic',
        icon: 'heroicons_outline:truck',
        link: '/deliveries',
        disabled: true,
        badge: soon,
        roles: ALL,
    },
    {
        id: 'procurement',
        title: 'Procurement',
        type: 'basic',
        icon: 'heroicons_outline:clipboard-document-list',
        link: '/procurement',
        disabled: true,
        badge: soon,
        roles: ['operations_manager', 'admin'],
    },
    {
        id: 'logistics',
        title: 'Logistics',
        type: 'basic',
        icon: 'heroicons_outline:map',
        link: '/logistics',
        disabled: true,
        badge: soon,
        roles: ['operations_manager', 'admin'],
    },
    {
        id: 'hub',
        title: 'Hub',
        type: 'basic',
        icon: 'heroicons_outline:building-storefront',
        link: '/hub',
        disabled: true,
        badge: soon,
        roles: ['operations_manager', 'admin'],
    },
    {
        id: 'analytics',
        title: 'Analytics',
        type: 'basic',
        icon: 'heroicons_outline:chart-pie',
        link: '/analytics',
        disabled: true,
        badge: soon,
        roles: ['operations_manager', 'admin'],
    },
    {
        id: 'administration',
        title: 'Administration',
        type: 'basic',
        icon: 'heroicons_outline:cog-6-tooth',
        link: '/admin',
        disabled: true,
        badge: soon,
        roles: ['admin'],
    },
];

/** Build the Fuse navigation items visible to `role` (empty when signed out). */
export function buildNavigation(role: UserRole | null): FuseNavigationItem[] {
    if (!role) {
        return [];
    }
    return NAVIGATION.filter((item) => item.roles.includes(role)).map(
        ({ roles, ...item }) => item
    );
}
