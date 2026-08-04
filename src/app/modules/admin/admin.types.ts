/**
 * Local response/request shapes for the Admin console.
 *
 * The backend's OpenAPI spec does not declare response schemas for AdminApi
 * (every method reads as `Promise<void>` in the generated client — see
 * `admin.service.ts`), so these interfaces are the provisional contract used
 * to parse the raw JSON bodies. Fields are optional/flexible on purpose:
 * unknown or renamed backend fields degrade gracefully instead of throwing.
 */

/**
 * Approval lifecycle of a restaurant account (BR-AUTH-1). Only the
 * `restaurant` role has one — every other role answers `null`, which is why
 * the column renders "—" rather than "chưa duyệt" for staff accounts.
 *
 * Values verified against the live API's `restaurantStatus` filter, which
 * accepts `pending` / `active` / `suspended` and rejects anything else.
 */
export const RESTAURANT_APPROVAL_STATUSES = [
    'pending',
    'active',
    'suspended',
] as const;

export type RestaurantApprovalStatusValue =
    (typeof RESTAURANT_APPROVAL_STATUSES)[number];

export interface AdminUserRow {
    id: string;
    email?: string;
    role?: string;
    isActive?: boolean;
    /** `true` / `false` for restaurants, `null` for every other role. */
    isApproved?: boolean | null;
    /** `pending` | `active` | `suspended`, restaurants only. */
    restaurantStatus?: string | null;
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
    /** Restaurant approval lifecycle — see {@link RESTAURANT_APPROVAL_STATUSES}. */
    restaurantStatus?: string;
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
/**
 * `GET/PUT /admin/operational-settings`.
 *
 * The PUT body is a **positional record** on the server
 * (`UpdateOperationalSettingsRequest`), so every field must be sent on every
 * save: an omitted `deliveryWindowDays` binds to `0` and fails its `1..30`
 * validator (400), and an omitted `deliveryFeePerKm` falls back to the
 * constructor default of `5000`, silently overwriting whatever was configured.
 */
export interface AdminOperationalSettings {
    dailyCutoffTime?: string;
    batchingEnabled?: boolean;
    defaultRouteType?: string | null;
    /** Days ahead a delivery route may be scheduled (1–30). */
    deliveryWindowDays?: number;
    /** VND per km used to price delivery on order confirmation (0–1,000,000). */
    deliveryFeePerKm?: number;
}

/** Pricing settings (`GET/PUT /admin/pricing-settings`). */
export interface AdminPricingSettings {
    /** Percent (0.01–100) swing that triggers a price alert. */
    priceAlertThresholdPercent?: number;
}

/**
 * `GET /admin/order-groups/progress` — how far the current batching run has
 * got. Untyped in the spec; these names come from the live response, which
 * counts **items** rather than batches:
 *
 * ```json
 * { "summary": { "batchDate": "2026-08-04", "totalBatches": 1,
 *                "statusCounts": { "Built": 1, "Manifested": 0, … },
 *                "totalItems": 1, "itemsPurchased": 0, "itemsPending": 1,
 *                "openExceptions": 0 },
 *   "batches": [ { "batchId": …, "itemsTotal": 1, "itemsPurchased": 0, … } ] }
 * ```
 */
export interface AdminOrderGroupProgressSummary {
    batchDate?: string;
    totalBatches?: number;
    statusCounts?: Record<string, number>;
    totalItems?: number;
    itemsPurchased?: number;
    itemsPending?: number;
    openExceptions?: number;
    [key: string]: unknown;
}

export interface AdminOrderGroupProgress {
    summary?: AdminOrderGroupProgressSummary;
    batches?: Record<string, unknown>[];
    [key: string]: unknown;
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

/** A purchased/planned line item inside a batch (`batch.items[]`). */
export interface AdminBatchItem {
    marketProductId?: string | null;
    productNameSnapshot?: string | null;
    totalQuantity?: number | null;
    referenceUnitPrice?: number | null;
    actualQuantity?: number | null;
    actualUnitPrice?: number | null;
    purchasedAt?: string | null;
    [key: string]: unknown;
}

/** An order that belongs to a batch (`batch.members[]`). */
export interface AdminBatchMember {
    orderId?: string | null;
    status?: string | null;
    [key: string]: unknown;
}

/** A line item of an order (`order.items[]`, `GET /orders/{orderId}`). */
export interface AdminOrderItem {
    orderItemId?: string | null;
    marketProductId?: string | null;
    productNameSnapshot?: string | null;
    quantity?: number | null;
    unitPrice?: number | null;
    subtotal?: number | null;
    actualQuantity?: number | null;
    [key: string]: unknown;
}

/** Full order detail (`GET /orders/{orderId}`), for the batch member drill-down. */
export interface AdminOrderDetail {
    orderId?: string | null;
    restaurantId?: string | null;
    restaurantName?: string | null;
    status?: string | null;
    paymentStatus?: string | null;
    scheduledFor?: string | null;
    totalAmount?: number | null;
    notes?: string | null;
    items?: AdminOrderItem[] | null;
    createdAt?: string | null;
    cancelledAt?: string | null;
    cancellationReason?: string | null;
    [key: string]: unknown;
}

/** Filters for `GET /orders` (M5 Orders — Admin sees every restaurant's orders). */
export interface AdminOrderListFilters {
    restaurantId?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
}

export interface AdminOrdersResult {
    orders: AdminOrderDetail[];
    totalCount: number;
    page?: number;
    pageSize?: number;
}

/** Order statuses the backend rejects a cancel for (BR: §PATCH /orders/{id}/cancel). */
export const ORDER_NOT_CANCELLABLE_STATUSES = new Set([
    'processing',
    'in_transit',
    'delivered',
]);

/**
 * The pre-hub stage an ops user may advance each status to, mirroring
 * `Order.AllowedTransitions` ∩ `AdvanceOrderStatusCommandHandler.AllowedTargets`
 * (batched / picked_up / at_hub only — Delivering and Delivered stay owned by
 * Logistics delivery events, and Cancelled must go through `Cancel`).
 *
 * The map is the whole client-side gate: `ORDER_STATUS_NOT_ADVANCEABLE` is not
 * listed in the backend's `ErrorExtensions`, so an out-of-range target falls
 * through to a **500** rather than a readable 4xx. Offering only the one legal
 * next stage means that response is unreachable from this console.
 */
export const ORDER_ADVANCE_NEXT_STATUS: Record<string, string> = {
    confirmed: 'batched',
    batched: 'picked_up',
    picked_up: 'at_hub',
};

/**
 * Statuses whose order the backend refuses to adjust quantities on
 * (`Order.RecordActualQuantity` → `ORDER_CANNOT_ADJUST`, 409). A draft has no
 * fulfilled reality yet and a cancelled order will never have one.
 */
export const ORDER_NOT_ADJUSTABLE_STATUSES = new Set(['draft', 'cancelled']);

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

/**
 * `POST /admin/order-groups/reset` — undoes a day's batching so auto-batch can
 * be re-run. `confirmation` is the backend's guard against an accidental
 * reset; whatever the admin types is forwarded verbatim and the server decides
 * whether it matches.
 */
export interface AdminResetOrderGroupsPayload {
    /** ISO date (`yyyy-MM-dd`); omit to let the backend use its own default. */
    targetDate?: string | null;
    confirmation?: string | null;
}

/**
 * One batch auto-batch would create. Live shape:
 *
 * ```json
 * { "batchDate": "2026-08-05", "marketId": "…", "status": "Built",
 *   "coveredOrderIds": ["…", "…"],
 *   "items": [{ "marketProductId": "…", "productNameSnapshot": "Bơ",
 *               "totalQuantity": 4 }] }
 * ```
 */
export interface AdminAutoBatchBatch {
    batchDate?: string | null;
    marketId?: string | null;
    status?: string | null;
    /** The orders this batch would absorb. */
    coveredOrderIds?: string[] | null;
    /** Product lines merged across those orders. */
    items?: AdminBatchItem[] | null;
    [key: string]: unknown;
}

/**
 * Result of `POST /admin/order-groups/auto-batch`. The live body is
 *
 * ```json
 * { "batchesCreated": 0, "ordersBatched": 0, "itemsAggregated": 0,
 *   "skipped": true, "reason": "no_eligible_orders", "preview": [] }
 * ```
 *
 * The run answers `skipped` + `reason` when it does nothing — the one thing an
 * operator staring at a zero result needs to know.
 */
export interface AdminAutoBatchResult {
    /** Batches the run created (or, on a dry run, would create). */
    batchesCreated?: number | null;
    /** Orders folded into those batches. */
    ordersBatched?: number | null;
    /** Distinct product lines merged across those orders. */
    itemsAggregated?: number | null;
    /** True when the run did nothing; `reason` says why. */
    skipped?: boolean | null;
    /** Machine reason for a skipped run, e.g. `no_eligible_orders`. */
    reason?: string | null;
    /** The batches a dry run would create. */
    preview?: AdminAutoBatchBatch[] | null;
    /** Echoed back by the caller — the request's own arguments. */
    targetDate?: string | null;
    dryRun?: boolean | null;
    [key: string]: unknown;
}

/**
 * A restaurant's full profile as Admin sees it
 * (`GET /admin/restaurants/{restaurantId}/profile` →
 * `GetRestaurantProfileResponse`).
 *
 * This is the only place the legal/e-invoice fields are exposed to the console
 * — `GET /admin/users` carries just name/email/phone/status. Admin approves an
 * account against these (business licence, tax code, invoice identity), so they
 * have to be on screen before the approve button is pressed.
 */
export interface AdminRestaurantProfile {
    restaurantId?: string | null;
    name?: string | null;
    /** `pending` | `active` | `suspended` (lowercased server-side). */
    status?: string | null;
    address?: string | null;
    contactPerson?: string | null;
    /** Daily pickup window, `HH:mm:ss`. */
    pickupStart?: string | null;
    pickupEnd?: string | null;
    updatedAt?: string | null;
    /** Scanned business licence — a URL to open, not a value to print. */
    businessLicenseUrl?: string | null;
    taxCode?: string | null;
    invoiceLegalName?: string | null;
    invoiceAddress?: string | null;
    invoiceEmail?: string | null;
    [key: string]: unknown;
}

/** Flexible restaurant credit snapshot (`GET /restaurants/{id}/credit`, untyped). */
export interface AdminRestaurantCredit {
    creditLimit?: number;
    /** Live API field; `currentBalance` kept as a tolerated alias. */
    outstandingBalance?: number;
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

/** Filters for `GET /invoices` (financial oversight, admin = R). */
export interface AdminInvoiceFilters {
    restaurantId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
}

/** One invoice row (`GET /invoices`, untyped envelope). */
export interface AdminInvoiceRow {
    id: string;
    restaurantId?: string | null;
    restaurantName?: string | null;
    status?: string | null;
    totalAmount?: number | null;
    issuedAt?: string | null;
    dueAt?: string | null;
    [key: string]: unknown;
}

export interface AdminInvoicesResult {
    invoices: AdminInvoiceRow[];
    totalCount: number;
    page?: number;
    pageSize?: number;
}
