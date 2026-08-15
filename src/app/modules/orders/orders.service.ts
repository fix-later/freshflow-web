import { Injectable } from '@angular/core';
import {
    extractList,
    extractPagination,
    extractTotal,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import { DraftOrderItemRequest, marketSessionsApi, ordersApi } from 'contract';
import { DateTime } from 'luxon';
import { parseConfirmPreview } from './confirm-preview';
import {
    MarketSessionWindow,
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
     * The server's view of today's ordering window (BR-ORD-2).
     *
     * `OrderingWindowResponse` is `(dailyCutoffTime, deliveryWindowDays)` and
     * nothing more, so "is ordering still open" and "what is the earliest day"
     * are **derived** from the cutoff here. They used to be read from four
     * candidate field names each, none of which the backend has ever sent: the
     * open flag therefore resolved to `null`, defaulted to `true`, and the
     * cutoff notice could not appear at all.
     *
     * The explicit names are still read first, so a response that grows one
     * wins over the derivation. Times are compared in the browser's zone, the
     * same assumption the picker's local seed makes.
     */
    async getOrderingWindow(): Promise<OrderingWindow> {
        const res = await ordersApi.apiV1OrdersOrderingWindowGetRaw();
        const data =
            unwrapData<Record<string, unknown>>(await parseJson(res.raw)) ?? {};
        const cutoffTime = this._firstString(data, [
            'cutoffTime',
            'dailyCutoffTime',
            'cutoff',
        ]);
        const beforeCutoff = this._isBeforeCutoff(cutoffTime);
        const open = this._firstOf(data, [
            'isOpen',
            'isOrderingOpen',
            'isBeforeCutoff',
            'canOrder',
        ]);
        return {
            isOpen: open == null ? beforeCutoff ?? true : open === true,
            cutoffTime,
            earliestServiceDate:
                this._firstString(data, [
                    'earliestServiceDate',
                    'nextServiceDate',
                    'earliestDeliveryDate',
                    'serviceDate',
                ]) ?? this._earliestServiceDate(beforeCutoff),
            deliveryWindowDays: this._firstNumber(data, [
                'deliveryWindowDays',
                'deliveryWindow',
            ]),
        };
    }

    /**
     * Whether today's cutoff is still ahead, from a `HH:mm[:ss]` time-of-day.
     * `null` when there is no parseable cutoff, which means "unknown" rather
     * than "closed" — the caller must not lock a restaurant out on a missing
     * setting.
     */
    private _isBeforeCutoff(cutoffTime: string | null): boolean | null {
        const parts = cutoffTime?.match(/^(\d{1,2}):(\d{2})/);
        if (!parts) {
            return null;
        }
        const now = DateTime.now();
        return (
            now <
            now.set({
                hour: Number(parts[1]),
                minute: Number(parts[2]),
                second: 0,
                millisecond: 0,
            })
        );
    }

    /**
     * The first deliverable day: tomorrow while the cutoff is ahead, the day
     * after once it has passed — the rule the picker seeds itself with.
     */
    private _earliestServiceDate(beforeCutoff: boolean | null): string | null {
        return beforeCutoff === null
            ? null
            : DateTime.now()
                  .plus({ days: beforeCutoff ? 1 : 2 })
                  .toFormat('yyyy-MM-dd');
    }

    /**
     * The chợ's ordering session for one service date (`GET /market-sessions`).
     *
     * A chợ trades in sessions now: each has its own `closesAt`, which is what
     * actually stops an order — `/orders/ordering-window` only knows the
     * platform-wide default. `null` when the day has no session, which is not
     * an error: the backend generates them, and a day without one simply cannot
     * be ordered for.
     */
    async getMarketSession(
        marketId: string,
        serviceDate: string
    ): Promise<MarketSessionWindow | null> {
        // The generated client sends a `DateOnly` as
        // `date.toISOString().substring(0, 10)` — UTC. A `Date` built at local
        // midnight east of Greenwich would therefore query the *previous* day,
        // so the instant is pinned to UTC midnight and survives the conversion.
        const day = DateTime.fromISO(serviceDate, { zone: 'utc' }).toJSDate();
        const res = await marketSessionsApi.apiV1MarketSessionsGetRaw({
            marketId,
            from: day,
            to: day,
        });
        const rows = extractList(await parseJson(res.raw));
        const match = rows.find(
            (row) =>
                String(row['serviceDate'] ?? '').slice(0, 10) === serviceDate
        );
        if (!match) {
            return null;
        }
        return {
            id: String(match['id'] ?? ''),
            marketId: String(match['marketId'] ?? ''),
            marketName: (match['marketName'] as string | null) ?? null,
            serviceDate: String(match['serviceDate'] ?? '').slice(0, 10),
            status: String(match['status'] ?? '').toLowerCase(),
            closesAt: (match['closesAt'] as string | null) ?? null,
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
