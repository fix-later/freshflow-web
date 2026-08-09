/**
 * Recurring-order shapes. The OpenAPI spec declares no response schema for any
 * of these endpoints (every GET is documented as bare "200 OK"), so each field
 * is optional and read defensively — same approach as the credit and catalog
 * types.
 */

/** One line of a schedule's item template (`GET /orders/scheduled`, `GET .../{id}`). */
export interface ScheduledOrderItem {
    marketProductId: string;
    quantity: number;
}

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
    /**
     * SCRUM-386 — the item template the background job auto-confirms from. `null`/absent on
     * legacy schedules created before this field existed (those still generate an empty draft).
     */
    deliveryAddressId?: string | null;
    items?: ScheduledOrderItem[];
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

/**
 * Recurrence vocabulary. The OpenAPI spec types `recurrenceType` as an opaque
 * `minLength: 1` string, but the product docs name the two values it can take:
 * BR-ORD-5 — "Recurring orders generate concrete instances on a **daily/weekly**
 * schedule" — and UC-ORD-09 / FR-ORD-009 — "Nhà hàng tạo lịch đặt hàng lặp lại
 * hằng ngày hoặc hằng tuần". Sent uppercase, matching how this backend spells
 * every other enum on the wire (DRAFT, PENDING_APPROVAL, …).
 */
export const SCHEDULE_RECURRENCE_TYPES = ['DAILY', 'WEEKLY'] as const;

export type ScheduleRecurrenceType = (typeof SCHEDULE_RECURRENCE_TYPES)[number];

/** True when the value is one of the documented recurrence values. */
export function isKnownRecurrence(
    value: string | null | undefined
): value is ScheduleRecurrenceType {
    return (SCHEDULE_RECURRENCE_TYPES as readonly string[]).includes(
        (value ?? '').toUpperCase()
    );
}
