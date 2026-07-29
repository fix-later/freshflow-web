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
