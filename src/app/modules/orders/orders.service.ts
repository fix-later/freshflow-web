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
import { OrderRow, OrdersFilters, OrdersResult } from './orders.types';

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

    async confirmOrder(orderId: string): Promise<void> {
        await ordersApi.apiV1OrdersOrderIdConfirmPostRaw({ orderId });
    }

    async cancelOrder(orderId: string, reason?: string): Promise<void> {
        await ordersApi.apiV1OrdersOrderIdCancelPatchRaw({
            orderId,
            cancelOrderRequest: { reason: reason || undefined },
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
