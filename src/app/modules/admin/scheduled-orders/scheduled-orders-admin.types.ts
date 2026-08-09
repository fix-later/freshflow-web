/**
 * Recurring-order shapes for the admin console
 * (`/api/v1/orders/scheduled`, RBAC `admin,restaurant`).
 *
 * A scheduled order is a *template*, not an order: the backend's
 * `ScheduledOrderGenerationHostedService` turns it into concrete orders on the
 * recurrence, and those runs are what `…/instances` lists. Nothing here carries
 * money or line items — a schedule has neither until it has run.
 *
 * The OpenAPI snapshot declares no response schema for these endpoints (every
 * GET is documented as a bare "200 OK"), so the fields below are read
 * defensively and mirror `ScheduledOrderDto` / `OrderListItemDto` directly.
 */

/**
 * Recurrence values **as the server sends them** — `ScheduledOrderDtoMapper`
 * maps the domain enum through `ToApiRecurrenceType`, which lowercases. Writes
 * are parsed case-insensitively (`ScheduledOrderParsing.TryParseRecurrenceType`),
 * so sending the same lowercase form back is safe.
 */
export const ADMIN_RECURRENCE_TYPES = ['daily', 'weekly'] as const;

export type AdminRecurrenceType = (typeof ADMIN_RECURRENCE_TYPES)[number];

/** A recurring order template (`GET /orders/scheduled`). */
export interface AdminScheduledOrder {
    /** Normalized by `withId(rows, 'scheduledOrderId')`, so always present. */
    id: string;
    scheduledOrderId?: string | null;
    restaurantId?: string | null;
    recurrenceType?: string | null;
    firstRunAt?: string | null;
    /** Null until the generator has produced at least one order. */
    lastExecutedAt?: string | null;
    /** Set once cancelled; future runs stop, past ones stay ordinary orders. */
    cancelledAt?: string | null;
    notes?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    [key: string]: unknown;
}

/**
 * One concrete order a schedule has produced
 * (`GET /orders/scheduled/{id}/instances`, an `OrderListItemDto`).
 */
export interface AdminScheduledOrderInstance {
    /** Normalized by `withId(rows, 'orderId')`. */
    id: string;
    orderId?: string | null;
    restaurantId?: string | null;
    orderGroupId?: string | null;
    scheduledOrderId?: string | null;
    status?: string | null;
    paymentStatus?: string | null;
    totalAmount?: number | null;
    itemCount?: number | null;
    scheduledFor?: string | null;
    createdAt?: string | null;
    [key: string]: unknown;
}

/** Filters accepted by `GET /orders/scheduled`. */
export interface AdminScheduledOrderFilters {
    /** Optional for admin — omitted, the list spans every restaurant. */
    restaurantId?: string;
    includeCancelled?: boolean;
    page?: number;
    pageSize?: number;
}

/** One page of schedules. */
export interface AdminScheduledOrdersResult {
    schedules: AdminScheduledOrder[];
    totalCount: number;
    page?: number;
    pageSize?: number;
}

/** One page of a schedule's generated runs. */
export interface AdminScheduledOrderInstancesResult {
    instances: AdminScheduledOrderInstance[];
    totalCount: number;
    page?: number;
    pageSize?: number;
}

/**
 * Fields `PATCH /orders/scheduled/{id}` accepts. All optional — send only what
 * changed; `UpdateScheduledOrderCommand` leaves untouched fields alone.
 */
export interface AdminScheduledOrderUpdate {
    recurrenceType?: string | null;
    firstRunAt?: Date | null;
    notes?: string | null;
}

/** `CreateScheduledOrderCommandValidator` / `Update…` — `MaximumLength(500)`. */
export const SCHEDULED_ORDER_NOTES_MAX_LENGTH = 500;

/** True once the schedule has been cancelled — no further runs are generated. */
export function isScheduleCancelled(
    schedule: AdminScheduledOrder | null | undefined
): boolean {
    return !!schedule?.cancelledAt;
}

/** Pill classes matching the lifecycle colours used across the admin tables. */
export function scheduleStatusPillClass(
    schedule: AdminScheduledOrder | null | undefined
): string {
    return isScheduleCancelled(schedule)
        ? 'admin-pill admin-pill-danger'
        : 'admin-pill admin-pill-success';
}
