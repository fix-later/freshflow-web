import { UserRole } from 'app/core/user/user.types';

/**
 * Web capability keys derived from `specs/product/ROLE_MATRIX.md`.
 *
 * RBAC is **server-authoritative** (BR-AUTH-4); this map only decides what the
 * UI exposes (nav items, action buttons, route access). The server still
 * enforces every call and the UI degrades gracefully on a 403.
 */
export type Permission =
    // M3 Catalog
    | 'catalog:read'
    | 'catalog:manage'
    | 'markets:configure'
    // M4 Pricing
    | 'pricing:read'
    | 'pricing:history:read'
    | 'pricing:alerts:read'
    | 'pricing:alerts:configure'
    // M5 Orders
    | 'orders:create'
    | 'orders:read:own'
    | 'orders:read:all'
    | 'orders:recurring:manage'
    // M6 Credit
    | 'credit:read:own'
    | 'credit:manage'
    | 'credit:configure'
    // M7-M9 Operations
    | 'procurement:manage'
    | 'hub:manage'
    | 'logistics:manage'
    | 'logistics:vehicles:manage'
    // M10 Delivery
    | 'delivery:track'
    // M12 Analytics
    | 'analytics:read'
    | 'analytics:export'
    // M13 Admin
    | 'admin:approve'
    | 'admin:rbac'
    | 'admin:config'
    | 'admin:audit';

const RESTAURANT: Permission[] = [
    'catalog:read',
    'pricing:read',
    'pricing:alerts:read',
    'orders:create',
    'orders:read:own',
    'orders:recurring:manage',
    'credit:read:own',
    'delivery:track',
    'analytics:read',
];

const OPERATIONS: Permission[] = [
    'catalog:read',
    'markets:configure',
    'pricing:read',
    'pricing:history:read',
    'procurement:manage',
    'logistics:manage',
    'delivery:track',
    'analytics:read',
];

// Admin is a superset of Operations: no `operations_manager` account is issued
// today, so the admin account also runs procurement and logistics dispatch
// (ROLE_MATRIX § Current deployment).
const ADMIN: Permission[] = [
    ...OPERATIONS,
    'catalog:manage',
    'pricing:alerts:configure',
    'orders:read:all',
    'credit:read:own',
    'credit:manage',
    'credit:configure',
    'hub:manage',
    'logistics:vehicles:manage',
    'analytics:export',
    'admin:approve',
    'admin:rbac',
    'admin:config',
    'admin:audit',
];

/** Role → granted permissions. */
export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
    restaurant: new Set(RESTAURANT),
    operations_manager: new Set(OPERATIONS),
    admin: new Set(ADMIN),
};

/** True if `role` is granted `permission`. */
export function roleHasPermission(
    role: UserRole | null | undefined,
    permission: Permission
): boolean {
    return !!role && ROLE_PERMISSIONS[role].has(permission);
}
