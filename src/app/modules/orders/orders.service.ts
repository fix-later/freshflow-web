import { Injectable } from '@angular/core';
import {
    extractList,
    extractPagination,
    extractTotal,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import { DraftOrderItemRequest, ordersApi } from 'contract';
import { parseConfirmPreview } from './confirm-preview';
import {
    OrderConfirmPreview,
    OrderingWindow,
    OrderRow,
    OrdersFilters,
    OrdersResult,
} from './orders.types';

/**
 * The signed-in restaurant's own orders (`GET/POST /orders`, item CRUD,
 * confirm/cancel/reorder). Ownership is scoped server-side by the bearer
 * token — no `restaurantId` is sent from here. Response bodies are untyped
 * in the spec, so rows are cast against `OrderRow`'s catch-all shape, mirroring
 * `admin.service.ts`'s order handling.
 */
@Injectable({ providedIn: 'root' })
export class OrdersService {
    async listOrders(filters: OrdersFilters = {}): Promise<OrdersResult> {
        const res = await ordersApi.apiV1OrdersGetRaw({
            status: filters.status || undefined,
            from: filters.from ? new Date(filters.from) : undefined,
            to: filters.to ? new Date(filters.to) : undefined,
            page: filters.page,
            pageSize: filters.pageSize,
        });
        const body = await parseJson<unknown>(res.raw);
        const orders = withId<OrderRow>(extractList(body), 'orderId');
        const p = extractPagination(body);
        return {
            orders,
            totalCount: p?.total ?? extractTotal(body) ?? orders.length,
            page: p?.page,
            pageSize: p?.pageSize,
        };
    }

    /** Most recently placed order, or `null` if the restaurant has none yet. */
    async getLatestOrder(): Promise<OrderRow | null> {
        const { orders } = await this.listOrders({ pageSize: 5 });
        if (!orders.length) {
            return null;
        }
        return [...orders].sort((a, b) =>
            String(b['createdAt'] ?? '').localeCompare(
                String(a['createdAt'] ?? '')
            )
        )[0];
    }

    async getOrder(orderId: string): Promise<OrderRow | null> {
        const res = await ordersApi.apiV1OrdersOrderIdGetRaw({ orderId });
        const data = unwrapData<OrderRow>(await parseJson(res.raw));
        if (!data) {
            return null;
        }
        return withId([data], 'orderId')[0];
    }

    /** Creates a draft order and returns its id (for an immediate confirm). */
    async createOrder(
        items: DraftOrderItemRequest[],
        scheduledFor?: Date | null,
        notes?: string | null
    ): Promise<string> {
        const res = await ordersApi.apiV1OrdersPostRaw({
            createDraftOrderRequest: {
                items,
                scheduledFor: scheduledFor ?? undefined,
                notes: notes || undefined,
            },
        });
        const data = unwrapData<OrderRow>(await parseJson(res.raw));
        const row = data ? withId([data], 'orderId')[0] : null;
        if (!row?.id) {
            throw new Error('Order was created but returned no id');
        }
        return row.id;
    }

    /**
     * The server's verdict on the confirm gates before committing. Read
     * tolerantly: a body we can't interpret yields `canConfirm: true` so the
     * confirm still runs and the server stays the authority — the preview is
     * there to explain a refusal early, never to invent one.
     *
     * The live names lead each list (`wouldSucceed`, `issues`,
     * `remainingCreditAfter`); the rest are kept as tolerated aliases. They
     * used to be absent, so the verdict always fell through to `true` and the
     * gate never fired — a refusal surfaced as a generic failure on confirm
     * instead of a specific reason before it.
     */
    async getConfirmPreview(
        orderId: string,
        deliveryAddressId: string
    ): Promise<OrderConfirmPreview> {
        // `deliveryAddressId` is required — see `confirmOrder`. Without it the
        // route resolves the address to `Guid.Empty` and answers
        // `404 DELIVERY_ADDRESS_NOT_FOUND`, and the priced breakdown
        // (`subtotalAmount` / `deliveryFee` / `vatAmount`) never arrives.
        const res = await ordersApi.apiV1OrdersOrderIdConfirmPreviewGetRaw({
            orderId,
            deliveryAddressId,
        });
        return parseConfirmPreview(
            unwrapData<Record<string, unknown>>(await parseJson(res.raw))
        );
    }

    /**
     * Commits a draft order to the delivery address it ships to.
     *
     * `deliveryAddressId` is **required**: without a body the backend answers
     * `415` (no content type) or `400 VALIDATION_ERROR — 'Delivery Address Id'
     * must not be empty`, which once left every checkout with a draft it could
     * never confirm — the restaurant's order list filled with drafts and
     * auto-batching reported `no_eligible_orders`. The spec now declares
     * `ConfirmOrderRequest`, so this rides the generated client again.
     */
    async confirmOrder(
        orderId: string,
        deliveryAddressId: string
    ): Promise<void> {
        await ordersApi.apiV1OrdersOrderIdConfirmPostRaw({
            orderId,
            confirmOrderRequest: { deliveryAddressId },
        });
    }

    /** Marks a delivered order as received by the restaurant. Takes no body. */
    async confirmReceipt(orderId: string): Promise<void> {
        await ordersApi.apiV1OrdersOrderIdReceiptPatchRaw({ orderId });
    }

    /**
     * Reports a post-delivery problem. `orderItemId` scopes the report to one
     * line (omit for a whole-order issue); `affectedQuantity` is how much of
     * that line was wrong.
     */
    async reportIssue(
        orderId: string,
        issue: {
            issueType: string;
            description: string;
            orderItemId?: string | null;
            affectedQuantity?: number | null;
        }
    ): Promise<void> {
        await ordersApi.apiV1OrdersOrderIdIssuesPostRaw({
            orderId,
            reportOrderIssueRequest: {
                issueType: issue.issueType,
                description: issue.description,
                orderItemId: issue.orderItemId || null,
                affectedQuantity: issue.affectedQuantity ?? undefined,
            },
        });
    }

    private _stringList(
        data: Record<string, unknown>,
        keys: string[]
    ): string[] {
        for (const key of keys) {
            const value = data[key];
            if (Array.isArray(value) && value.length) {
                return value
                    .map((entry) =>
                        typeof entry === 'string'
                            ? entry
                            : String(
                                  (entry as Record<string, unknown>)?.[
                                      'message'
                                  ] ??
                                      (entry as Record<string, unknown>)?.[
                                          'code'
                                      ] ??
                                      ''
                              )
                    )
                    .filter(Boolean);
            }
        }
        return [];
    }

    private _firstNumber(
        data: Record<string, unknown>,
        keys: string[]
    ): number | null {
        const value = this._firstOf(data, keys);
        return typeof value === 'number' && !Number.isNaN(value) ? value : null;
    }

    async cancelOrder(orderId: string, reason?: string): Promise<void> {
        await ordersApi.apiV1OrdersOrderIdCancelPatchRaw({
            orderId,
            cancelOrderRequest: { reason: reason || undefined },
        });
    }

    /**
     * The server's view of today's ordering window (BR-ORD-2). The response is
     * untyped in the spec and the backend has spelled these fields more than
     * one way, so each is read tolerantly and left `null` when absent — the
     * caller keeps its local cutoff rule as the fallback.
     */
    async getOrderingWindow(): Promise<OrderingWindow> {
        const res = await ordersApi.apiV1OrdersOrderingWindowGetRaw();
        const data =
            unwrapData<Record<string, unknown>>(await parseJson(res.raw)) ?? {};
        const open = this._firstOf(data, [
            'isOpen',
            'isOrderingOpen',
            'isBeforeCutoff',
            'canOrder',
        ]);
        return {
            isOpen: open == null ? true : open === true,
            cutoffTime: this._firstString(data, [
                'cutoffTime',
                'dailyCutoffTime',
                'cutoff',
            ]),
            earliestServiceDate: this._firstString(data, [
                'earliestServiceDate',
                'nextServiceDate',
                'earliestDeliveryDate',
                'serviceDate',
            ]),
            deliveryWindowDays: this._firstNumber(data, [
                'deliveryWindowDays',
                'deliveryWindow',
            ]),
        };
    }

    private _firstOf(
        data: Record<string, unknown>,
        keys: string[]
    ): unknown | null {
        for (const key of keys) {
            if (data[key] != null) {
                return data[key];
            }
        }
        return null;
    }

    private _firstString(
        data: Record<string, unknown>,
        keys: string[]
    ): string | null {
        const value = this._firstOf(data, keys);
        return typeof value === 'string' && value.trim() ? value.trim() : null;
    }

    /**
     * Adds a line to a **draft** order (`POST /orders/{orderId}/items`).
     *
     * `marketProductId` is `format: uuid` and `quantity` is an `int32` with
     * `exclusiveMinimum: 0` on `AddOrderItemRequest` — both are checked by
     * `orders.validation.ts` before the call, so a 422 here means the order
     * left draft or the listing became unavailable, not a typo.
     */
    async addItem(
        orderId: string,
        marketProductId: string,
        quantity: number
    ): Promise<void> {
        await ordersApi.apiV1OrdersOrderIdItemsPostRaw({
            orderId,
            addOrderItemRequest: { marketProductId, quantity },
        });
    }

    /** Changes a draft line's quantity (`PUT /orders/{orderId}/items/{itemId}`). */
    async updateItemQuantity(
        orderId: string,
        itemId: string,
        quantity: number
    ): Promise<void> {
        await ordersApi.apiV1OrdersOrderIdItemsItemIdPut({
            orderId,
            itemId,
            updateOrderItemRequest: { quantity },
        });
    }

    /** Removes a draft line (`DELETE /orders/{orderId}/items/{itemId}`). */
    async removeItem(orderId: string, itemId: string): Promise<void> {
        await ordersApi.apiV1OrdersOrderIdItemsItemIdDelete({
            orderId,
            itemId,
        });
    }

    async reorder(
        orderId: string,
        options: { scheduledFor?: Date | null; notes?: string | null } = {}
    ): Promise<void> {
        await ordersApi.apiV1OrdersOrderIdReorderPostRaw({
            orderId,
            reorderFromHistoryRequest: {
                scheduledFor: options.scheduledFor ?? undefined,
                notes: options.notes || undefined,
            },
        });
    }
}
