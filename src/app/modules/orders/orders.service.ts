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
    MarketSessionAvailability,
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

    /**
     * Edits a draft order in place (`PATCH /orders/{id}/draft`).
     *
     * Before this endpoint existed neither field could be changed after
     * creation, so checkout had to open a *second* draft just to carry the
     * buyer's note — leaving the cart's own draft behind, unconfirmed. Now the
     * cart's draft is the order that gets confirmed.
     *
     * **Both fields are written every call.** The handler assigns whatever it
     * is given, so an omitted `scheduledFor` clears the draft's delivery date
     * rather than leaving it alone; send the value to keep, not just the value
     * to change.
     *
     * Draft-only: the backend answers `409 ORDER_NOT_DRAFT` once the order is
     * confirmed — both fields are part of what the restaurant agreed to — and
     * `422 DELIVERY_DATE_OUT_OF_WINDOW` for a date outside the D..D+n booking
     * window, the same rule order creation applies.
     */
    async updateDraftOrder(
        orderId: string,
        draft: { notes?: string | null; scheduledFor?: Date | null }
    ): Promise<void> {
        await ordersApi.apiV1OrdersOrderIdDraftPatchRaw({
            orderId,
            updateDraftOrderRequest: {
                notes: draft.notes ?? null,
                scheduledFor: draft.scheduledFor ?? null,
            },
        });
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
     * The chợ's ordering session for one service date.
     *
     * A chợ trades in sessions now: each has its own `closesAt`, which is what
     * actually stops an order — `/orders/ordering-window` only knows the
     * platform-wide default. `null` when the day has no session, which is not
     * an error: the backend generates them, and a day without one simply cannot
     * be ordered for.
     *
     * Two endpoints answer this, and both are needed:
     *  - `GET /market-sessions/availability` decides **whether** the day can be
     *    ordered into. The server resolves the session for that exact date
     *    itself, so its `exists` / `status` beat matching `serviceDate` strings
     *    against a filtered list on this side.
     *  - `GET /market-sessions` supplies **`closesAt`** (and `marketName`),
     *    which availability does not return and which the checkout counts down
     *    to.
     *
     * They run in parallel, so this still costs one round-trip of latency, and
     * either one failing leaves the other in charge: only when *both* fail does
     * this reject, which is what tells the caller the answer is unknown rather
     * than "no session". (Availability is `restaurant`-only, so a non-buyer
     * session gets 403 there and falls back to the list, as before.)
     */
    async getMarketSession(
        marketId: string,
        serviceDate: string
    ): Promise<MarketSessionWindow | null> {
        const [availability, listed] = await Promise.allSettled([
            this.getMarketSessionAvailability(marketId, serviceDate),
            this._listedMarketSession(marketId, serviceDate),
        ]);
        if (
            availability.status === 'rejected' &&
            listed.status === 'rejected'
        ) {
            throw availability.reason;
        }
        const verdict =
            availability.status === 'fulfilled' ? availability.value : null;
        const row = listed.status === 'fulfilled' ? listed.value : null;

        // The server says there is nothing to order into: authoritative, even
        // when the list happened to return a row for a neighbouring day.
        if (verdict && !verdict.exists) {
            return null;
        }
        if (!row) {
            // No list row — either it failed or it filtered nothing out. Build
            // the window from the verdict, minus the deadline it cannot carry.
            return verdict?.exists
                ? {
                      id: verdict.sessionId ?? '',
                      marketId: verdict.marketId || marketId,
                      marketName: null,
                      serviceDate: verdict.serviceDate || serviceDate,
                      status: (verdict.status ?? '').toLowerCase(),
                      closesAt: null,
                  }
                : null;
        }
        return {
            ...row,
            // Prefer the server's own verdict on the status — it is what the
            // confirm call will enforce.
            status: verdict?.status ? verdict.status.toLowerCase() : row.status,
        };
    }

    /**
     * `GET /market-sessions/availability` — whether `marketId` can be ordered
     * into on `serviceDate`, decided server-side.
     *
     * Restaurant-scoped, and it answers `400 VALIDATION_ERROR` when either
     * argument is missing, so both are required here too.
     */
    async getMarketSessionAvailability(
        marketId: string,
        serviceDate: string
    ): Promise<MarketSessionAvailability> {
        const res =
            await marketSessionsApi.apiV1MarketSessionsAvailabilityGetRaw({
                marketId,
                serviceDate: this._utcDay(serviceDate),
            });
        const data =
            unwrapData<Record<string, unknown>>(await parseJson(res.raw)) ?? {};
        return {
            marketId: String(data['marketId'] ?? marketId),
            serviceDate: String(data['serviceDate'] ?? serviceDate).slice(
                0,
                10
            ),
            exists: data['exists'] === true,
            isOpen: data['isOpen'] === true,
            status: (data['status'] as string | null) ?? null,
            sessionId: (data['sessionId'] as string | null) ?? null,
        };
    }

    /** The session row for one day, read off the buyer-facing list endpoint. */
    private async _listedMarketSession(
        marketId: string,
        serviceDate: string
    ): Promise<MarketSessionWindow | null> {
        const day = this._utcDay(serviceDate);
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

    /**
     * `yyyy-MM-dd` as the instant the generated client will serialise back to
     * that same day.
     *
     * It sends a `DateOnly` as `date.toISOString().substring(0, 10)` — UTC. A
     * `Date` built at local midnight east of Greenwich would therefore query
     * the *previous* day, so the instant is pinned to UTC midnight and survives
     * the conversion.
     */
    private _utcDay(serviceDate: string): Date {
        return DateTime.fromISO(serviceDate, { zone: 'utc' }).toJSDate();
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
