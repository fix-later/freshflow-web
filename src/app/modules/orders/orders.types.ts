/** A line item of an order (`order.items[]`, `GET /orders/{orderId}`). Untyped in the spec. */
export interface OrderItem {
    orderItemId?: string | null;
    marketProductId?: string | null;
    productNameSnapshot?: string | null;
    quantity?: number | null;
    unitPrice?: number | null;
    subtotal?: number | null;
    actualQuantity?: number | null;
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
}

/**
 * `GET /orders/{orderId}/confirm-preview` — the server's verdict on the
 * confirm gates (approval · cutoff · credit · order state, see role-flows
 * §4.3) *before* the restaurant commits. Untyped in the spec, so every field
 * is optional and read tolerantly; an unreadable body is treated as "no
 * objection" and the confirm proceeds, letting the server reject it.
 */
export interface OrderConfirmPreview {
    /** False only when the server explicitly says the order cannot confirm. */
    canConfirm: boolean;
    /** Machine codes or human reasons explaining a refusal. */
    blockers: string[];
    /** Priced total the restaurant is about to commit to. */
    totalAmount: number | null;
    /** Credit still available after this order, when reported. */
    availableCredit: number | null;
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
