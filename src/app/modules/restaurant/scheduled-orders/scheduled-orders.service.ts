import { Injectable, inject } from '@angular/core';
import {
    extractList,
    extractTotal,
    fetchAllOffset,
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
    ScheduledOrderItem,
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
 * `SCHEDULE_RECURRENCE_TYPES`.
 *
 * SCRUM-386: `CreateScheduledOrderRequest`/`UpdateScheduledOrderRequest` now also carry an item
 * template (`items`) and `deliveryAddressId` — the background job auto-confirms a real order
 * from these at each due occurrence instead of leaving an empty draft. `deliveryAddressId` and
 * `items` are required on create; both optional (omit to keep unchanged) on update.
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
     * Creates a recurring schedule (UC-ORD-09). `recurrenceType`, `firstRunAt`,
     * `deliveryAddressId` and `items` are all required by
     * `CreateScheduledOrderRequest`; `notes` is optional and capped at 500.
     */
    async createScheduled(input: {
        recurrenceType: string;
        firstRunAt: Date;
        notes?: string | null;
        deliveryAddressId: string;
        items: ScheduledOrderItem[];
    }): Promise<void> {
        await ordersApi.apiV1OrdersScheduledPostRaw({
            createScheduledOrderRequest: {
                recurrenceType: input.recurrenceType,
                firstRunAt: input.firstRunAt,
                notes: input.notes || undefined,
                deliveryAddressId: input.deliveryAddressId,
                items: input.items,
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
     * When `items` is sent it wholesale-replaces the existing template.
     */
    async updateScheduled(
        scheduledOrderId: string,
        changes: {
            recurrenceType?: string | null;
            firstRunAt?: Date | null;
            notes?: string | null;
            deliveryAddressId?: string | null;
            items?: ScheduledOrderItem[] | null;
        }
    ): Promise<void> {
        await ordersApi.apiV1OrdersScheduledScheduledOrderIdPatchRaw({
            scheduledOrderId,
            updateScheduledOrderRequest: {
                recurrenceType: changes.recurrenceType ?? undefined,
                firstRunAt: changes.firstRunAt ?? undefined,
                notes: changes.notes ?? undefined,
                deliveryAddressId: changes.deliveryAddressId ?? undefined,
                items: changes.items ?? undefined,
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
    /**
     * Every order of one status, walked page by page.
     *
     * The history filter takes a single status, so a grouped tab ("đang xử lý"
     * is three of them) has to read each one whole and merge — there is no page
     * 2 of a group. Bounded by {@link MAX_PAGE_SIZE} per request and by the
     * shared crawl's own page cap, and only ever used for the in-flight
     * statuses, which are few.
     */
    async listAllHistory(options: {
        status: string;
        from?: Date;
        to?: Date;
    }): Promise<OrderHistoryEntry[]> {
        const restaurantId = await this._restaurantId();
        const rows = await fetchAllOffset<Record<string, unknown>>(
            (page, pageSize) =>
                ordersApi
                    .apiV1OrdersHistoryGetRaw({
                        restaurantId,
                        status: options.status,
                        from: options.from,
                        to: options.to,
                        sort: 'createdAt:desc',
                        page,
                        pageSize,
                    })
                    .then((res) => res.raw)
        );
        return withId(rows, 'orderId') as unknown as OrderHistoryEntry[];
    }

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
