import { Injectable, inject } from '@angular/core';
import {
    extractList,
    extractTotal,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import { RestaurantProfileService } from 'app/modules/restaurant/restaurant-profile.service';
import { ordersApi, restaurantProfileApi } from 'contract';
import {
    OrderHistoryEntry,
    RestaurantApprovalStatus,
    ScheduledOrder,
    ScheduledOrderInstance,
} from './scheduled-orders.types';

/** Rows per request for the paged lists below. */
export const SCHEDULED_PAGE_SIZE = 20;

/**
 * The restaurant's recurring orders, delivered order history, and approval
 * state — the three restaurant-facing endpoints the profile area did not reach.
 *
 * `GET /orders/scheduled` and `/orders/history` both accept an optional
 * `restaurantId`, resolved from `GET /restaurants/me/profile` — **not** from
 * the signed-in user's id, which is a different id and answers 403 here.
 *
 * Recurrence is daily or weekly (BR-ORD-5, UC-ORD-09/FR-ORD-009) — see
 * `SCHEDULE_RECURRENCE_TYPES`. `CreateScheduledOrderRequest` carries no items:
 * per UC-ORD-11/FR-ORD-011 the *system* generates each concrete order from the
 * schedule, so the lines are the backend's to resolve and this client sends
 * only the three fields the request model declares.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantScheduledOrdersService {
    private readonly _profileService = inject(RestaurantProfileService);

    /** Recurring order templates. `includeCancelled` shows ended schedules too. */
    async listScheduled(
        page = 1,
        includeCancelled = false
    ): Promise<{ items: ScheduledOrder[]; total?: number }> {
        const restaurantId = await this._restaurantId();
        const res = await ordersApi.apiV1OrdersScheduledGetRaw({
            restaurantId,
            includeCancelled,
            page,
            pageSize: SCHEDULED_PAGE_SIZE,
        });
        const body = await parseJson(res.raw);
        return {
            items: withId<ScheduledOrder>(
                extractList(body),
                'scheduledOrderId'
            ),
            total: extractTotal(body),
        };
    }

    /**
     * Creates a recurring schedule (UC-ORD-09). `recurrenceType` and
     * `firstRunAt` are both required by `CreateScheduledOrderRequest`;
     * `notes` is optional and capped at 500.
     */
    async createScheduled(input: {
        recurrenceType: string;
        firstRunAt: Date;
        notes?: string | null;
    }): Promise<void> {
        await ordersApi.apiV1OrdersScheduledPostRaw({
            createScheduledOrderRequest: {
                recurrenceType: input.recurrenceType,
                firstRunAt: input.firstRunAt,
                notes: input.notes || undefined,
            },
        });
    }

    async getScheduled(
        scheduledOrderId: string
    ): Promise<ScheduledOrder | null> {
        const res = await ordersApi.apiV1OrdersScheduledScheduledOrderIdGetRaw({
            scheduledOrderId,
        });
        return unwrapData<ScheduledOrder>(await parseJson(res.raw)) ?? null;
    }

    /** The runs a schedule has produced so far. */
    async listInstances(
        scheduledOrderId: string,
        page = 1
    ): Promise<{ items: ScheduledOrderInstance[]; total?: number }> {
        const res =
            await ordersApi.apiV1OrdersScheduledScheduledOrderIdInstancesGetRaw(
                { scheduledOrderId, page, pageSize: SCHEDULED_PAGE_SIZE }
            );
        const body = await parseJson(res.raw);
        return {
            items: withId<ScheduledOrderInstance>(
                extractList(body),
                'instanceId',
                'orderId'
            ),
            total: extractTotal(body),
        };
    }

    /**
     * Edits a schedule in place (`PATCH /orders/scheduled/{id}`). Every field
     * is optional on `UpdateScheduledOrderRequest` — send only what changed.
     */
    async updateScheduled(
        scheduledOrderId: string,
        changes: {
            recurrenceType?: string | null;
            firstRunAt?: Date | null;
            notes?: string | null;
        }
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

    /** Stops future runs. The runs already placed stay as ordinary orders. */
    async cancelScheduled(scheduledOrderId: string): Promise<void> {
        await ordersApi.apiV1OrdersScheduledScheduledOrderIdCancelPatchRaw({
            scheduledOrderId,
        });
    }

    /**
     * Past orders. Distinct from `GET /orders`, which lists the live working
     * set — this one is the archive and takes a date range and status filter.
     */
    async listHistory(options?: {
        page?: number;
        status?: string;
        /** The generated client types this range as `Date`, not ISO strings. */
        from?: Date;
        to?: Date;
        sort?: string;
    }): Promise<{ items: OrderHistoryEntry[]; total?: number }> {
        const restaurantId = await this._restaurantId();
        const res = await ordersApi.apiV1OrdersHistoryGetRaw({
            restaurantId,
            status: options?.status,
            from: options?.from,
            to: options?.to,
            sort: options?.sort,
            page: options?.page ?? 1,
            pageSize: SCHEDULED_PAGE_SIZE,
        });
        const body = await parseJson(res.raw);
        return {
            items: withId<OrderHistoryEntry>(extractList(body), 'orderId'),
            total: extractTotal(body),
        };
    }

    /**
     * Approval gate state (BR-AUTH-1). A restaurant awaiting approval can browse
     * but not order, and the profile overview says so rather than letting the
     * buyer discover it at checkout.
     */
    async getApprovalStatus(): Promise<RestaurantApprovalStatus | null> {
        const res =
            await restaurantProfileApi.apiV1RestaurantsMeApprovalStatusGetRaw();
        return (
            unwrapData<RestaurantApprovalStatus>(await parseJson(res.raw)) ??
            null
        );
    }

    private _restaurantId(): Promise<string> {
        return this._profileService.restaurantId();
    }
}
