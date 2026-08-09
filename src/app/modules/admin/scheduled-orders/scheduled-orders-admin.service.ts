import { Injectable } from '@angular/core';
import {
    extractList,
    extractPagination,
    extractTotal,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import { ordersApi } from 'contract';
import {
    AdminScheduledOrder,
    AdminScheduledOrderFilters,
    AdminScheduledOrderInstance,
    AdminScheduledOrderInstancesResult,
    AdminScheduledOrderUpdate,
    AdminScheduledOrdersResult,
} from './scheduled-orders-admin.types';

/**
 * Recurring-order oversight for the admin console.
 *
 * The five `/orders/scheduled` endpoints are all `admin,restaurant`. What the
 * role changes is the *scope*: `ListScheduledOrdersQueryHandler` only forces the
 * caller's own restaurant when `IsAdmin` is false, so for an admin
 * `restaurantId` is a genuine filter — omit it and the list spans every
 * restaurant on the platform. The restaurant-facing
 * `RestaurantScheduledOrdersService` always pins it to the signed-in
 * restaurant instead, which is why this is a separate service rather than a
 * flag on that one.
 *
 * Like the rest of the admin services, these go through the generated `*Raw`
 * methods (URL, query string, bearer auth, 401 refresh-and-retry) and parse the
 * body here, because the spec publishes no response schema for them.
 */
@Injectable({ providedIn: 'root' })
export class ScheduledOrdersAdminService {
    /**
     * Recurring schedules, newest first as the API returns them.
     *
     * `includeCancelled` defaults to false server-side, which hides every
     * ended schedule — the admin list makes it a toggle rather than a
     * permanent blind spot.
     */
    async getScheduledOrders(
        filters: AdminScheduledOrderFilters = {}
    ): Promise<AdminScheduledOrdersResult> {
        const res = await ordersApi.apiV1OrdersScheduledGetRaw({
            restaurantId: filters.restaurantId || undefined,
            includeCancelled: filters.includeCancelled ?? undefined,
            page: filters.page,
            pageSize: filters.pageSize,
        });
        const body = await parseJson<unknown>(res.raw);
        const schedules = withId<AdminScheduledOrder>(
            extractList(body),
            'scheduledOrderId'
        );
        const p = extractPagination(body);
        return {
            schedules,
            totalCount: p?.total ?? extractTotal(body) ?? schedules.length,
            page: p?.page,
            pageSize: p?.pageSize,
        };
    }

    /**
     * One schedule by id. Answers 404 `SCHEDULED_ORDER_NOT_FOUND` for an
     * unknown id — admins are not ownership-scoped here.
     */
    async getScheduledOrder(
        scheduledOrderId: string
    ): Promise<AdminScheduledOrder | null> {
        const res = await ordersApi.apiV1OrdersScheduledScheduledOrderIdGetRaw({
            scheduledOrderId,
        });
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        const [row] = withId<AdminScheduledOrder>(
            [data as AdminScheduledOrder],
            'scheduledOrderId'
        );
        return row?.id ? row : null;
    }

    /**
     * The concrete orders this schedule has generated so far. These are
     * ordinary orders — the ids link straight into `/admin/orders/{id}`.
     */
    async getInstances(
        scheduledOrderId: string,
        page = 1,
        pageSize = 20
    ): Promise<AdminScheduledOrderInstancesResult> {
        const res =
            await ordersApi.apiV1OrdersScheduledScheduledOrderIdInstancesGetRaw(
                { scheduledOrderId, page, pageSize }
            );
        const body = await parseJson<unknown>(res.raw);
        const instances = withId<AdminScheduledOrderInstance>(
            extractList(body),
            'orderId'
        );
        const p = extractPagination(body);
        return {
            instances,
            totalCount: p?.total ?? extractTotal(body) ?? instances.length,
            page: p?.page,
            pageSize: p?.pageSize,
        };
    }

    /**
     * Edits a schedule in place. Every field on `UpdateScheduledOrderRequest`
     * is optional, so only what changed is sent; an unparseable
     * `recurrenceType` comes back as `VALIDATION_ERROR` (400) naming the two
     * accepted values.
     */
    async updateScheduledOrder(
        scheduledOrderId: string,
        changes: AdminScheduledOrderUpdate
    ): Promise<void> {
        await ordersApi.apiV1OrdersScheduledScheduledOrderIdPatchRaw({
            scheduledOrderId,
            updateScheduledOrderRequest: {
                recurrenceType: changes.recurrenceType ?? undefined,
                firstRunAt: changes.firstRunAt ?? undefined,
                notes: changes.notes ?? undefined,
            },
        });
    }

    /**
     * Stops future runs (`PATCH .../cancel`). The orders already generated are
     * untouched — they stay ordinary orders and are cancelled, if at all, one
     * by one through `PATCH /orders/{orderId}/cancel`.
     */
    async cancelScheduledOrder(scheduledOrderId: string): Promise<void> {
        await ordersApi.apiV1OrdersScheduledScheduledOrderIdCancelPatchRaw({
            scheduledOrderId,
        });
    }
}
