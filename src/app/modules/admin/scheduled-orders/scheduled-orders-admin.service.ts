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
import { AdminService } from '../admin.service';
import {
    AdminScheduledOrder,
    AdminScheduledOrderFilters,
    AdminScheduledOrderInstance,
    AdminScheduledOrderInstancesResult,
    AdminScheduledOrderRestaurantOption,
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
    private restaurantNamesPromise: Promise<Map<string, string>> | null = null;

    constructor(private readonly admin: AdminService) {}

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
        const enrichedSchedules = await this.withRestaurantNames(schedules);
        const p = extractPagination(body);
        return {
            schedules: enrichedSchedules,
            totalCount:
                p?.total ?? extractTotal(body) ?? enrichedSchedules.length,
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
        if (!row?.id) {
            return null;
        }
        return (await this.withRestaurantNames([row]))[0] ?? null;
    }

    /** Restaurant choices for the filter, without exposing UUIDs in the UI. */
    async getRestaurantOptions(): Promise<
        AdminScheduledOrderRestaurantOption[]
    > {
        const names = await this.getRestaurantNames();
        return [...names.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((left, right) => left.name.localeCompare(right.name));
    }

    /**
     * The concrete orders this schedule has generated so far. These are
     * ordinary orders, listed here for the record — Admin no longer has an
     * order screen to open them in.
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

    /** Adds restaurant display names without changing the scheduled-order API. */
    private async withRestaurantNames(
        schedules: AdminScheduledOrder[]
    ): Promise<AdminScheduledOrder[]> {
        if (!schedules.length) {
            return schedules;
        }
        const names = await this.getRestaurantNames();
        return schedules.map((schedule) => ({
            ...schedule,
            restaurantName:
                names.get(this.restaurantKey(schedule.restaurantId)) ?? null,
        }));
    }

    /** Fetches every restaurant user once and indexes restaurant names by ID. */
    private getRestaurantNames(): Promise<Map<string, string>> {
        this.restaurantNamesPromise ??= this.admin
            .listUsersByRole('restaurant')
            .then((users) => {
                const names = new Map<string, string>();
                for (const user of users) {
                    const key = this.restaurantKey(user.restaurantId);
                    const name = String(
                        user.restaurantName ?? user.fullName ?? user.email ?? ''
                    ).trim();
                    if (key && name) {
                        names.set(key, name);
                    }
                }
                return names;
            })
            .catch((error: unknown) => {
                this.restaurantNamesPromise = null;
                throw error;
            });
        return this.restaurantNamesPromise;
    }

    private restaurantKey(value: string | null | undefined): string {
        return String(value ?? '')
            .trim()
            .toLowerCase();
    }
}
