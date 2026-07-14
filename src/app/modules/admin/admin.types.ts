/**
 * Local response/request shapes for the Admin console.
 *
 * The backend's OpenAPI spec does not declare response schemas for AdminApi
 * (every method reads as `Promise<void>` in the generated client — see
 * `admin.service.ts`), so these interfaces are the provisional contract used
 * to parse the raw JSON bodies. Fields are optional/flexible on purpose:
 * unknown or renamed backend fields degrade gracefully instead of throwing.
 */

export interface AdminUserRow {
    id: string;
    email?: string;
    role?: string;
    isActive?: boolean;
    phone?: string | null;
    restaurantId?: string | null;
    restaurantName?: string | null;
    marketId?: string | null;
    lockedUntil?: string | null;
    createdAt?: string | null;
    [key: string]: unknown;
}

export interface AdminUsersPage {
    items?: AdminUserRow[];
    data?: AdminUserRow[];
    totalCount?: number;
    total?: number;
    page?: number;
    pageSize?: number;
}

/** Normalized shape produced by `AdminService.getUsers()`. */
export interface AdminUsersResult {
    users: AdminUserRow[];
    totalCount: number;
}

/** A role as returned by `GET /api/v1/admin/roles` — string or `{ name }`. */
export type AdminRoleEntry = string | { name?: string; roleName?: string };

/** A market assignment — bare market id or `{ marketId, name }`. */
export type AdminMarketAssignmentEntry =
    | string
    | { marketId?: string; id?: string; name?: string };

export interface AdminMarketOption {
    id: string;
    name: string;
}

export interface AdminUserFilters {
    role?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface AdminCreateUserPayload {
    email: string;
    password: string;
    role: string;
    marketId?: string | null;
    restaurantName?: string | null;
    phone?: string | null;
}

export interface AdminSetCreditLimitPayload {
    creditLimit?: number;
    note?: string | null;
}

export interface AdminSettleCreditPayload {
    amount?: number;
    paymentMethod?: string | null;
    reference?: string | null;
    note?: string | null;
}

/** Flexible restaurant credit snapshot (`GET /restaurants/{id}/credit`, untyped). */
export interface AdminRestaurantCredit {
    creditLimit?: number;
    currentBalance?: number;
    availableCredit?: number;
    [key: string]: unknown;
}
