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
    /** 1-based page and size the backend echoed back (for page tracking). */
    page?: number;
    pageSize?: number;
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

/**
 * Platform-wide operational settings (`GET/PUT /admin/operational-settings`).
 * Mirrors `UpdateOperationalSettingsRequest`; `dailyCutoffTime` is an
 * `HH:mm[:ss]` time-of-day string, not a full timestamp.
 */
export interface AdminOperationalSettings {
    dailyCutoffTime?: string;
    batchingEnabled?: boolean;
    defaultRouteType?: string | null;
}

/** Pricing settings (`GET/PUT /admin/pricing-settings`). */
export interface AdminPricingSettings {
    /** Percent (0.01–100) swing that triggers a price alert. */
    priceAlertThresholdPercent?: number;
}

export interface AdminAuditLogFilters {
    actorId?: string;
    action?: string;
    entityType?: string;
    /** ISO date (`yyyy-MM-dd`) — converted to a `Date` for the query string. */
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
}

export interface AdminAuditLogRow {
    id?: string;
    actorId?: string | null;
    actorEmail?: string | null;
    action?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    timestamp?: string | null;
    createdAt?: string | null;
    [key: string]: unknown;
}

export interface AdminAuditLogsResult {
    entries: AdminAuditLogRow[];
    totalCount: number;
    page?: number;
    pageSize?: number;
}

/** A procurement batch row from `GET /admin/order-groups`. */
export interface AdminOrderGroupRow {
    id?: string;
    batchId?: string;
    batchNumber?: string | null;
    status?: string | null;
    marketId?: string | null;
    marketName?: string | null;
    agentId?: string | null;
    agentEmail?: string | null;
    orderCount?: number | null;
    itemCount?: number | null;
    targetDate?: string | null;
    createdAt?: string | null;
    [key: string]: unknown;
}

export interface AdminOrderGroupsResult {
    groups: AdminOrderGroupRow[];
    totalCount: number;
    page?: number;
    pageSize?: number;
}

export interface AdminAutoBatchPayload {
    /** ISO date (`yyyy-MM-dd`); omit to let the backend use its own default. */
    targetDate?: string | null;
    dryRun?: boolean | null;
    force?: boolean | null;
}

/** One batch created (or, on a dry run, that would be created) by auto-batch. */
export interface AdminAutoBatchBatch {
    orderGroupId?: string | null;
    deliveryZone?: string | null;
    sourceMarketId?: string | null;
    sourceMarketName?: string | null;
    orderIds?: string[] | null;
    [key: string]: unknown;
}

/** An order the run skipped, with the reason code (e.g. `ALREADY_BATCHED`). */
export interface AdminAutoBatchSkipped {
    orderId?: string | null;
    reason?: string | null;
    [key: string]: unknown;
}

/** Result of `POST /admin/order-groups/auto-batch` (see doc §4.2). */
export interface AdminAutoBatchResult {
    targetDate?: string | null;
    dryRun?: boolean | null;
    createdBatchCount?: number | null;
    batchedOrderCount?: number | null;
    skippedOrderCount?: number | null;
    batches?: AdminAutoBatchBatch[] | null;
    skippedOrders?: AdminAutoBatchSkipped[] | null;
    triggeredBy?: string | null;
    triggeredAt?: string | null;
    [key: string]: unknown;
}

/** Flexible restaurant credit snapshot (`GET /restaurants/{id}/credit`, untyped). */
export interface AdminRestaurantCredit {
    creditLimit?: number;
    currentBalance?: number;
    availableCredit?: number;
    [key: string]: unknown;
}

/**
 * A monthly credit statement row
 * (`GET /restaurants/{id}/credit/statements`, untyped envelope).
 */
export interface AdminCreditStatement {
    id: string;
    year?: number;
    month?: number;
    openingBalance?: number;
    closingBalance?: number;
    totalCharges?: number;
    totalPayments?: number;
    generatedAt?: string;
    [key: string]: unknown;
}

/**
 * A single credit ledger entry
 * (`GET /restaurants/{id}/credit/transactions`, untyped envelope).
 */
export interface AdminCreditTransaction {
    id: string;
    createdAt?: string;
    type?: string;
    amount?: number;
    balanceAfter?: number;
    description?: string;
    reference?: string;
    [key: string]: unknown;
}

/** Period selector for generating a statement (`POST .../credit/statements/generate`). */
export interface AdminGenerateStatementPayload {
    year: number;
    month: number;
}
