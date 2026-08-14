/** A line item of an order (`order.items[]`, `GET /orders/{orderId}`). Untyped in the spec. */
export interface OrderItem {
    orderItemId?: string | null;
    marketProductId?: string | null;
    productNameSnapshot?: string | null;
    quantity?: number | null;
    unitPrice?: number | null;
    subtotal?: number | null;
    actualQuantity?: number | null;
    /** Packing code snapshotted onto the line (`OrderItemDto.PackingCode`). */
    packingCode?: string | null;
    [key: string]: unknown;
}

/** One order (`GET /orders`, `GET /orders/{orderId}`). Untyped in the spec. */
export interface OrderRow {
    id?: string | null;
    orderId?: string | null;
    status?: string | null;
    paymentStatus?: string | null;
    scheduledFor?: string | null;
    totalAmount?: number | null;
    notes?: string | null;
    /** Populated on the list endpoints (`GET /orders`, `GET /orders/history`) instead of `items`. */
    itemCount?: number | null;
    items?: OrderItem[] | null;
    createdAt?: string | null;
    cancelledAt?: string | null;
    cancellationReason?: string | null;
    [key: string]: unknown;
}

export interface OrdersResult {
    orders: OrderRow[];
    totalCount: number;
    page?: number;
    pageSize?: number;
}

export interface OrdersFilters {
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
}

/**
 * `GET /orders/ordering-window` — the server's own answer to "can I still
 * order for the next service day, and when is the earliest delivery?". The
 * response is untyped in the spec, so the fields are all optional and the
 * caller falls back to the local cutoff rule (BR-ORD-2) for anything missing.
 */
export interface OrderingWindow {
    /** False once today's cutoff has passed. */
    isOpen: boolean;
    /** Daily cutoff as `HH:mm`, when the server reports one. */
    cutoffTime: string | null;
    /** Earliest deliverable service date as `yyyy-MM-dd`, when reported. */
    earliestServiceDate: string | null;
    /**
     * How many days ahead a delivery may be booked — the admin's
     * `deliveryWindowDays` operational setting (1–30), which the live response
     * carries alongside `dailyCutoffTime`. `null` when the server omits it, so
     * the picker keeps its own default.
     */
    deliveryWindowDays: number | null;
}

/**
 * `GET /orders/{orderId}/confirm-preview` — the server's verdict on the
 * confirm gates (approval · cutoff · credit · order state, see role-flows
 * §4.3) *before* the restaurant commits. Untyped in the spec, so every field
 * is optional and read tolerantly; an unreadable body is treated as "no
 * objection" and the confirm proceeds, letting the server reject it.
 */
/**
 * `GET /orders/{orderId}/confirm-preview?deliveryAddressId=…`. The live body is
 *
 * ```json
 * { "wouldSucceed": true, "issues": [], "totalAmount": 126250,
 *   "resolvedScheduledFor": "2026-08-06T06:45:05.681Z",
 *   "remainingCreditAfter": 773750, "subtotalAmount": 110000,
 *   "vatAmount": 0, "deliveryFee": 16250, "deliveryDistanceKm": 3.25 }
 * ```
 *
 * This is the only endpoint that prices delivery, and only when the address is
 * supplied — the fee depends on the distance to it.
 */
/**
 * One reason the confirm would be refused, as the preview reports it:
 * `PreviewIssueDto(Code, Message)`. The message is the backend's English, so
 * the code is what a screen should localize from — see `describeApiCode`.
 */
export interface PreviewIssue {
    code: string | null;
    message: string | null;
}

export interface OrderConfirmPreview {
    /** False only when the server explicitly says the order cannot confirm. */
    canConfirm: boolean;
    /** Every reason for a refusal (`issues`), code and message kept apart. */
    blockers: PreviewIssue[];
    /** Priced total the restaurant is about to commit to. */
    totalAmount: number | null;
    /** Credit left after this order (`remainingCreditAfter`), when reported. */
    availableCredit: number | null;
    /**
     * The delivery slot the server actually settled on. It can differ from what
     * was requested when the cutoff rolls the order to the next cycle
     * (BR-ORD-2), so the buyer is told before committing rather than finding
     * out from the confirmation.
     */
    resolvedScheduledFor: string | null;
    /** Goods total before delivery and tax (`subtotalAmount`). */
    subtotal: number | null;
    /** Delivery fee the server priced for this address (`deliveryFee`). */
    deliveryFee: number | null;
    /** Distance the fee was priced from, in km (`deliveryDistanceKm`). */
    deliveryDistanceKm: number | null;
    /** Tax the server charges (`vatAmount`) — currently 0. */
    vatAmount: number | null;
}

/**
 * Issue kinds accepted by `POST /orders/{orderId}/issues`. Sent as-is; the
 * matching labels live under `orders.detail.issueType.*` in the i18n files.
 */
export const ORDER_ISSUE_TYPES = [
    'missing',
    'damaged',
    'wrong_item',
    'quality',
    'other',
] as const;

export type OrderIssueType = (typeof ORDER_ISSUE_TYPES)[number];

/** Order lifecycle statuses (mirrors the admin orders list's vocabulary). */
export const ORDER_STATUSES = [
    'draft',
    'batched',
    'pending',
    'confirmed',
    'processing',
    'ready_for_pickup',
    'in_transit',
    'at_hub',
    'delivered',
    'cancelled',
];

/** Order statuses the backend rejects a cancel for (mirrors admin.types.ts). */
export const ORDER_NOT_CANCELLABLE_STATUSES = new Set([
    'processing',
    'in_transit',
    'delivered',
]);

/** Normalizes a raw status string (`ReadyForPickup`, `ready-for-pickup`, …) to `snake_case`. */
export function normalizeOrderStatus(
    status: string | null | undefined
): string {
    const raw = String(status ?? '').trim();
    if (!raw) {
        return '';
    }
    return raw
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}

/** Pill class for an order status — mirrors the admin orders list's coloring. */
export function orderStatusPillClass(
    status: string | null | undefined
): string {
    switch (normalizeOrderStatus(status)) {
        case 'delivered':
            return 'admin-pill admin-pill-success';
        case 'cancelled':
            return 'admin-pill admin-pill-danger';
        case 'processing':
            return 'admin-pill admin-pill-warning';
        case 'in_transit':
            return 'admin-pill admin-pill-teal';
        case 'at_hub':
            return 'admin-pill admin-pill-lime';
        case 'ready_for_pickup':
            return 'admin-pill admin-pill-cyan';
        case 'confirmed':
            return 'admin-pill admin-pill-purple';
        case 'pending':
            return 'admin-pill admin-pill-info';
        case 'batched':
            return 'admin-pill admin-pill-indigo';
        case 'draft':
            return 'admin-pill admin-pill-pink';
        default:
            return 'admin-pill admin-pill-neutral';
    }
}

/** Whether an order can still be cancelled (not processing/in_transit/delivered). */
export function canCancelOrder(status: string | null | undefined): boolean {
    return !ORDER_NOT_CANCELLABLE_STATUSES.has(normalizeOrderStatus(status));
}
