/**
 * Recurring-order shapes. The OpenAPI spec declares no response schema for any
 * of these endpoints (every GET is documented as bare "200 OK"), so each field
 * is optional and read defensively — same approach as the credit and catalog
 * types.
 */

/** A recurring order template (`GET /orders/scheduled`). */
export interface ScheduledOrder {
    id: string;
    /** Backend vocabulary is not enumerated in the spec — treat as opaque. */
    recurrenceType?: string;
    firstRunAt?: string;
    nextRunAt?: string;
    status?: string;
    notes?: string;
    itemCount?: number;
    totalAmount?: number;
    cancelledAt?: string | null;
    [key: string]: unknown;
}

/** One generated run of a schedule (`GET /orders/scheduled/{id}/instances`). */
export interface ScheduledOrderInstance {
    id: string;
    orderId?: string;
    runAt?: string;
    status?: string;
    totalAmount?: number;
    [key: string]: unknown;
}

/** A past order row (`GET /orders/history`). */
export interface OrderHistoryEntry {
    id: string;
    orderCode?: string;
    status?: string;
    placedAt?: string;
    deliveredAt?: string;
    totalAmount?: number;
    itemCount?: number;
    marketName?: string;
    [key: string]: unknown;
}

/** Approval gate state (`GET /restaurants/me/approval-status`, BR-AUTH-1). */
export interface RestaurantApprovalStatus {
    status?: string;
    reason?: string;
    reviewedAt?: string;
    [key: string]: unknown;
}
