import { Injectable, inject } from '@angular/core';
import {
    extractList,
    extractTotal,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import { UserService } from 'app/core/user/user.service';
import { ordersApi, restaurantProfileApi } from 'contract';
import { firstValueFrom } from 'rxjs';
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
 * `restaurantId`; the signed-in user's id doubles as their restaurant id in this
 * backend (same assumption `RestaurantCreditService` documents), so it is
 * resolved here rather than passed in by callers.
 *
 * Creating a schedule is deliberately absent: `CreateScheduledOrderRequest`
 * takes only `recurrenceType`, `firstRunAt` and `notes` — no items — and the
 * spec neither enumerates the recurrence vocabulary nor says where the lines
 * come from. Guessing that contract would invent business logic, so the UI
 * lists, inspects and cancels schedules until the backend semantics are known.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantScheduledOrdersService {
    private readonly _userService = inject(UserService);

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

    private async _restaurantId(): Promise<string> {
        const current =
            this._userService.current ??
            (await firstValueFrom(this._userService.user$));
        if (!current?.id) {
            throw new Error(
                'No signed-in user to resolve a restaurant id from'
            );
        }
        return current.id;
    }
}
