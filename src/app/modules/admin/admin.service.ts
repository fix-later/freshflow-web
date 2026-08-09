import { Injectable } from '@angular/core';
import {
    extractList,
    extractPagination,
    extractTotal,
    fetchAllCursor,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import {
    adminApi,
    hubsApi,
    invoicesApi,
    marketsApi,
    ordersApi,
    rawApi,
    restaurantCreditApi,
} from 'contract';
import { DateTime } from 'luxon';
import {
    AdminAuditLogFilters,
    AdminAuditLogRow,
    AdminAuditLogsResult,
    AdminAutoBatchPayload,
    AdminAutoBatchResult,
    AdminCreateUserPayload,
    AdminCreditStatement,
    AdminCreditStatementDetail,
    AdminCreditStatementLine,
    AdminCreditTransaction,
    AdminGenerateStatementPayload,
    AdminInvoiceFilters,
    AdminInvoiceRow,
    AdminInvoicesResult,
    AdminMarketOption,
    AdminOperationalSettings,
    AdminOrderDetail,
    AdminOrderGroupProgress,
    AdminOrderGroupRow,
    AdminOrderGroupsResult,
    AdminOrderListFilters,
    AdminOrdersResult,
    AdminPricingSettings,
    AdminResetOrderGroupsPayload,
    AdminRestaurantCredit,
    AdminRestaurantProfile,
    AdminRoleEntry,
    AdminSetCreditLimitPayload,
    AdminSettleCreditPayload,
    AdminUserFilters,
    AdminUserRow,
    AdminUsersResult,
} from './admin.types';
import {
    deriveBatchNumber,
    resolveBatchNumber,
} from './order-groups/order-group-batch-code';

/** Role eligible to be assigned a procurement batch (see ROLE_MATRIX). */
const MARKET_AGENT_ROLE = 'market_agent';

/**
 * The zone statement period boundaries are computed in server-side
 * (`CreditStatementPeriodCalculator.VietnamTimeZone`, DEC-CRE-03). Reading a
 * period's calendar month in any other zone lands on the wrong month.
 */
const STATEMENT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * Admin console data access — backed by the generated OpenAPI client.
 *
 * The backend's OpenAPI spec does not declare response schemas for AdminApi
 * (every endpoint is documented as "200 OK" with no body type), so the
 * generated methods all read as `Promise<void>`. We therefore always call
 * the generated `*Raw` variants (which still build the URL, query string,
 * bearer auth and 401/403/5xx handling for us) and parse the response body
 * ourselves against the provisional shapes in `admin.types.ts`.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
    // -------------------------------------------------------------------
    // Users
    // -------------------------------------------------------------------

    async getUsers(filters: AdminUserFilters = {}): Promise<AdminUsersResult> {
        const res = await adminApi.apiV1AdminUsersGetRaw({
            role: filters.role || undefined,
            isActive: filters.isActive,
            search: filters.search || undefined,
            // Server-side, so the count and paging stay honest — filtering
            // approval client-side would only ever narrow the current page.
            restaurantStatus: filters.restaurantStatus || undefined,
            page: filters.page,
            pageSize: filters.pageSize,
        });
        const body = await parseJson<unknown>(res.raw);
        const users = withId<AdminUserRow>(extractList(body), 'userId');
        const p = extractPagination(body);
        return {
            users,
            totalCount: p?.total ?? extractTotal(body) ?? users.length,
            page: p?.page,
            pageSize: p?.pageSize,
        };
    }

    async createUser(payload: AdminCreateUserPayload): Promise<void> {
        await adminApi.apiV1AdminUsersPostRaw({
            createUserCommand: payload,
        });
    }

    async setUserActive(userId: string, isActive: boolean): Promise<void> {
        await adminApi.apiV1AdminUsersUserIdActivatePatchRaw({
            userId,
            activateRequest: { isActive },
        });
    }

    async unlockUser(userId: string): Promise<void> {
        await adminApi.apiV1AdminUsersUserIdUnlockPostRaw({ userId });
    }

    async assignRole(userId: string, roleName: string): Promise<void> {
        await adminApi.apiV1AdminUsersUserIdRolePatchRaw({
            userId,
            assignRoleRequest: { roleName },
        });
    }

    async getMarketAssignments(userId: string): Promise<string[]> {
        const res = await adminApi.apiV1AdminUsersUserIdMarketAssignmentsGetRaw(
            { userId }
        );
        const body = await parseJson<unknown>(res.raw);
        const data = unwrapData<unknown>(body) ?? body;
        return this._assignmentMarketIds(data);
    }

    /**
     * Pulls the assigned market ids out of the (untyped) market-assignments
     * body, tolerating both a bare array and an object wrapper that names the
     * array `marketIds` / `markets` / `assignments` / `items`, and entries that
     * are either plain id strings or objects.
     */
    private _assignmentMarketIds(data: unknown): string[] {
        let list: unknown[] = [];
        if (Array.isArray(data)) {
            list = data;
        } else if (data && typeof data === 'object') {
            const record = data as Record<string, unknown>;
            for (const key of [
                'marketIds',
                'markets',
                'assignments',
                'items',
                'results',
                'value',
                'data',
            ]) {
                if (Array.isArray(record[key])) {
                    list = record[key] as unknown[];
                    break;
                }
            }
        }
        return list
            .map((entry) => {
                if (typeof entry === 'string') {
                    return entry;
                }
                if (entry && typeof entry === 'object') {
                    const e = entry as Record<string, unknown>;
                    const value =
                        e['marketId'] ??
                        e['marketID'] ??
                        e['market_id'] ??
                        e['id'];
                    return typeof value === 'string' ? value : null;
                }
                return null;
            })
            .filter((id): id is string => !!id);
    }

    async replaceMarketAssignments(
        userId: string,
        marketIds: string[]
    ): Promise<void> {
        await adminApi.apiV1AdminUsersUserIdMarketAssignmentsPutRaw({
            userId,
            replaceMarketAssignmentsRequest: { marketIds },
        });
    }

    /**
     * Loads every `market_agent` user and their market-assignments, then
     * builds marketId → agent for the markets table.
     */
    async getMarketAgentsWithAssignments(): Promise<{
        agents: AdminUserRow[];
        agentsByMarket: Map<string, AdminUserRow>;
    }> {
        const { users } = await this.getUsers({ role: MARKET_AGENT_ROLE });
        const agents = users.filter((u) => !!u.id);
        const pairs = await Promise.all(
            agents.map(async (agent) => ({
                agent,
                markets: await this.getMarketAssignments(agent.id),
            }))
        );
        const agentsByMarket = new Map<string, AdminUserRow>();
        for (const { agent, markets } of pairs) {
            for (const marketId of markets) {
                agentsByMarket.set(marketId, agent);
            }
        }
        return { agents, agentsByMarket };
    }

    /**
     * Resolves which market-agent (if any) currently holds each market, by
     * reading every agent's assignment list. There is no market→agent GET.
     */
    async getAgentsByMarketId(): Promise<Map<string, AdminUserRow>> {
        const { agentsByMarket } = await this.getMarketAgentsWithAssignments();
        return agentsByMarket;
    }

    /**
     * Makes `agentUserId` the sole agent for `marketId` (or clears the
     * assignment when `agentUserId` is null) via market-assignments PUT.
     * Other agents that held this market lose it; the chosen agent keeps
     * their other markets.
     */
    async setMarketAgent(
        marketId: string,
        agentUserId: string | null,
        previousAgentId: string | null = null
    ): Promise<void> {
        const previous = previousAgentId || null;
        if (previous === (agentUserId || null)) {
            return;
        }

        // Drop the market from the previous agent's assignment list.
        if (previous) {
            const markets = await this.getMarketAssignments(previous);
            await this.replaceMarketAssignments(
                previous,
                markets.filter((id) => id !== marketId)
            );
        }

        // Add the market to the new agent's assignment list.
        if (agentUserId) {
            const markets = await this.getMarketAssignments(agentUserId);
            if (!markets.includes(marketId)) {
                await this.replaceMarketAssignments(agentUserId, [
                    ...markets,
                    marketId,
                ]);
            }
        }
    }

    // -------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------

    async getRoles(): Promise<string[]> {
        const res = await adminApi.apiV1AdminRolesGetRaw();
        const body = await parseJson<unknown>(res.raw);
        const entries = extractList<AdminRoleEntry>(body);
        return entries
            .map((entry) =>
                typeof entry === 'string' ? entry : entry.name ?? entry.roleName
            )
            .filter((name): name is string => !!name);
    }

    // -------------------------------------------------------------------
    // Restaurants
    // -------------------------------------------------------------------

    /**
     * The restaurant's full profile, including the legal/e-invoice fields the
     * user list does not carry (`GET /admin/restaurants/{id}/profile`).
     *
     * Sent through `rawApi`: the route exists on the backend but is absent from
     * the `openapi.json` snapshot, so there is no generated method for it yet.
     * Everything else (bearer auth, 401 refresh-and-retry, typed errors) is
     * identical to a generated call. Drop this once `npm run generate:api`
     * catches up.
     *
     * Answers 404 `RESTAURANT_NOT_FOUND` for an id that no longer exists.
     */
    async getRestaurantProfile(
        restaurantId: string
    ): Promise<AdminRestaurantProfile | null> {
        const res = await rawApi.send(
            `/api/v1/admin/restaurants/${encodeURIComponent(
                restaurantId
            )}/profile`,
            'GET'
        );
        return unwrapData<AdminRestaurantProfile>(await parseJson(res)) ?? null;
    }

    async approveRestaurant(restaurantId: string): Promise<void> {
        await adminApi.apiV1AdminRestaurantsRestaurantIdApprovePatchRaw({
            restaurantId,
        });
    }

    async suspendRestaurant(restaurantId: string): Promise<void> {
        await adminApi.apiV1AdminRestaurantsRestaurantIdSuspendPatchRaw({
            restaurantId,
        });
    }

    async reactivateRestaurant(restaurantId: string): Promise<void> {
        await adminApi.apiV1AdminRestaurantsRestaurantIdReactivatePatchRaw({
            restaurantId,
        });
    }

    async setCreditLimit(
        restaurantId: string,
        payload: AdminSetCreditLimitPayload
    ): Promise<void> {
        await adminApi.apiV1AdminRestaurantsRestaurantIdCreditLimitPutRaw({
            restaurantId,
            setCreditLimitRequest: payload,
        });
    }

    async settleCredit(
        restaurantId: string,
        payload: AdminSettleCreditPayload
    ): Promise<void> {
        await adminApi.apiV1AdminRestaurantsRestaurantIdCreditSettlePostRaw({
            restaurantId,
            settleCreditRequest: payload,
        });
    }

    /** Best-effort credit snapshot — used to prefill the restaurant screen. */
    async getRestaurantCredit(
        restaurantId: string
    ): Promise<AdminRestaurantCredit | null> {
        try {
            const res =
                await restaurantCreditApi.apiV1RestaurantsRestaurantIdCreditGetRaw(
                    { restaurantId }
                );
            // `{ success, data }` — without unwrapping, every field read off
            // the snapshot is `undefined` and the card renders 0 ₫ / "—".
            return (
                unwrapData<AdminRestaurantCredit>(await parseJson(res.raw)) ??
                null
            );
        } catch {
            return null;
        }
    }

    /** Monthly credit statements, newest first (best-effort; empty on failure). */
    async getCreditStatements(
        restaurantId: string
    ): Promise<AdminCreditStatement[]> {
        try {
            const rows = await fetchAllCursor<AdminCreditStatement>(
                (cursor, pageSize) =>
                    restaurantCreditApi
                        .apiV1RestaurantsRestaurantIdCreditStatementsGetRaw({
                            restaurantId,
                            cursor,
                            pageSize,
                        })
                        .then((res) => res.raw)
            );
            return withId<AdminCreditStatement>(rows, 'statementId').map(
                (row) => normalizeCreditStatement(row)
            );
        } catch {
            return [];
        }
    }

    /**
     * One statement with its line items
     * (`GET /restaurants/{id}/credit/statements/{statementId}`).
     *
     * The list endpoint returns `CreditStatementSummaryDto` — headers only — so
     * the movements behind a closing balance, and the soft due date, are only
     * reachable here. This is the same body the PDF is rendered from, which is
     * why the two always agree.
     *
     * Answers 403 for a statement belonging to another restaurant and 404
     * `CREDIT_STATEMENT_NOT_FOUND` for an unknown id; both are left to the
     * caller rather than swallowed, since an operator opened this deliberately.
     */
    async getCreditStatement(
        restaurantId: string,
        statementId: string
    ): Promise<AdminCreditStatementDetail | null> {
        const res =
            await restaurantCreditApi.apiV1RestaurantsRestaurantIdCreditStatementsStatementIdGetRaw(
                { restaurantId, statementId }
            );
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        const [header] = withId<AdminCreditStatement>(
            [data as AdminCreditStatement],
            'statementId'
        );
        return {
            ...normalizeCreditStatement(header),
            dueDate: (data['dueDate'] as string | undefined) ?? undefined,
            lines: withId<AdminCreditStatementLine>(
                Array.isArray(data['lines'])
                    ? (data['lines'] as AdminCreditStatementLine[])
                    : [],
                'transactionId'
            ),
        };
    }

    /** Generates (or regenerates) the statement for a given year/month. */
    async generateCreditStatement(
        restaurantId: string,
        payload: AdminGenerateStatementPayload
    ): Promise<void> {
        await restaurantCreditApi.apiV1RestaurantsRestaurantIdCreditStatementsGeneratePostRaw(
            {
                restaurantId,
                generateStatementRequest: {
                    year: payload.year,
                    month: payload.month,
                },
            }
        );
    }

    /** Fetches a statement PDF as a Blob for download / preview. */
    async getStatementPdf(
        restaurantId: string,
        statementId: string
    ): Promise<Blob> {
        const res =
            await restaurantCreditApi.apiV1RestaurantsRestaurantIdCreditStatementsStatementIdPdfGetRaw(
                { restaurantId, statementId }
            );
        return res.raw.blob();
    }

    /** Credit ledger entries, newest first (best-effort; empty on failure). */
    async getCreditTransactions(
        restaurantId: string
    ): Promise<AdminCreditTransaction[]> {
        try {
            const rows = await fetchAllCursor<AdminCreditTransaction>(
                (cursor, pageSize) =>
                    restaurantCreditApi
                        .apiV1RestaurantsRestaurantIdCreditTransactionsGetRaw({
                            restaurantId,
                            cursor,
                            pageSize,
                        })
                        .then((res) => res.raw)
            );
            return withId<AdminCreditTransaction>(rows, 'transactionId');
        } catch {
            return [];
        }
    }

    // -------------------------------------------------------------------
    // Platform settings
    // -------------------------------------------------------------------

    async getOperationalSettings(): Promise<AdminOperationalSettings> {
        const res = await adminApi.apiV1AdminOperationalSettingsGetRaw();
        return (
            unwrapData<AdminOperationalSettings>(await parseJson(res.raw)) ?? {}
        );
    }

    async updateOperationalSettings(
        payload: AdminOperationalSettings
    ): Promise<void> {
        await adminApi.apiV1AdminOperationalSettingsPutRaw({
            updateOperationalSettingsRequest: payload,
        });
    }

    async getPricingSettings(): Promise<AdminPricingSettings> {
        const res = await adminApi.apiV1AdminPricingSettingsGetRaw();
        return unwrapData<AdminPricingSettings>(await parseJson(res.raw)) ?? {};
    }

    async updatePricingSettings(payload: AdminPricingSettings): Promise<void> {
        await adminApi.apiV1AdminPricingSettingsPutRaw({
            updatePricingSettingsRequest: payload,
        });
    }

    // -------------------------------------------------------------------
    // Order groups (procurement batching)
    // -------------------------------------------------------------------

    async getOrderGroups(
        page = 1,
        pageSize = 10,
        filters?: { date?: string; marketId?: string }
    ): Promise<AdminOrderGroupsResult> {
        const res = await adminApi.apiV1AdminOrderGroupsGetRaw({
            page,
            pageSize,
            date: filters?.date ? new Date(filters.date) : undefined,
            marketId: filters?.marketId || undefined,
        });
        const body = await parseJson<unknown>(res.raw);
        // The list nests the array at `data.batches` (see extractList); batch
        // routes use {batchId}, but the rows carry `id`.
        const rows = withId<AdminOrderGroupRow>(
            extractList(body),
            'batchId',
            'BatchId',
            'procurementBatchId'
        );
        const groups = await this._normalizeOrderGroups(rows);
        const p = extractPagination(body);
        return {
            groups,
            totalCount: p?.total ?? extractTotal(body) ?? groups.length,
            page: p?.page,
            pageSize: p?.pageSize,
        };
    }

    /**
     * Maps the backend batch shape onto the fields the order-groups table binds
     * (`marketName`/`agentId`/`orderCount`/`createdAt`), which the API spells
     * differently (`marketId`/`assignedAgentUserId`/`members`/`batchDate`), and
     * resolves market ids to names. Existing values win, so a backend that later
     * returns the display fields directly is untouched.
     */
    private async _normalizeOrderGroups(
        rows: AdminOrderGroupRow[]
    ): Promise<AdminOrderGroupRow[]> {
        const marketNames = await this._marketNameMap();
        return rows.map((row) => {
            const members = row['members'];
            const raw = row as Record<string, unknown>;
            const batchNumber =
                resolveBatchNumber(raw) || deriveBatchNumber(raw) || null;
            return {
                ...row,
                batchNumber,
                marketName:
                    row.marketName ??
                    marketNames.get(String(row.marketId ?? '')) ??
                    null,
                agentId:
                    row.agentId ??
                    (row['assignedAgentUserId'] as string | null) ??
                    (row['AssignedAgentUserId'] as string | null) ??
                    null,
                orderCount:
                    row.orderCount ??
                    (Array.isArray(members)
                        ? members.length
                        : (row['totalItemCount'] as number | null) ?? null),
                createdAt:
                    row.createdAt ??
                    (row['batchDate'] as string | null) ??
                    (row['BatchDate'] as string | null) ??
                    null,
            };
        });
    }

    /** Best-effort market id → name lookup, fetched once and cached. */
    private _marketNames?: Promise<Map<string, string>>;
    private _marketNameMap(): Promise<Map<string, string>> {
        return (this._marketNames ??= this.getMarkets()
            .then(
                (markets) =>
                    new Map(
                        markets.map((m) => [String(m.id), String(m.name ?? '')])
                    )
            )
            .catch(() => new Map<string, string>()));
    }

    /**
     * A single batch by id. There is no single-batch GET, so this pulls the
     * (small) list and finds it — the rows already carry full detail
     * (items / members / exceptions).
     */
    async getOrderGroup(batchId: string): Promise<AdminOrderGroupRow | null> {
        const { groups } = await this.getOrderGroups(1, 100);
        return groups.find((group) => group.id === batchId) ?? null;
    }

    /**
     * Runs auto-batching. `dryRun` asks the backend to report what it *would*
     * group without persisting, so the admin can preview before committing.
     */
    async runAutoBatch(
        payload: AdminAutoBatchPayload = {}
    ): Promise<AdminAutoBatchResult> {
        const res = await adminApi.apiV1AdminOrderGroupsAutoBatchPostRaw({
            runAutoBatchRequest: {
                targetDate: payload.targetDate
                    ? new Date(payload.targetDate)
                    : null,
                dryRun: payload.dryRun ?? null,
                force: payload.force ?? null,
            },
        });
        const result =
            unwrapData<AdminAutoBatchResult>(await parseJson(res.raw)) ?? {};
        // The response does not echo the request, but the banner has to say
        // whether what it is showing was applied or only previewed.
        return {
            ...result,
            targetDate: result.targetDate ?? payload.targetDate ?? null,
            dryRun: result.dryRun ?? payload.dryRun ?? null,
        };
    }

    /** Market-agent users, for the "assign agent" picker on a batch. */
    async getAgentOptions(): Promise<AdminUserRow[]> {
        const { users } = await this.getUsers({
            role: MARKET_AGENT_ROLE,
            isActive: true,
        });
        return users.filter((user) => !!user.id);
    }

    /**
     * Clears the batches for a day so auto-batch can be run again. Destructive
     * — the backend gates it behind `confirmation`, so a wrong (or missing)
     * phrase comes back as a validation error the caller surfaces.
     */
    async resetOrderGroups(
        payload: AdminResetOrderGroupsPayload = {}
    ): Promise<void> {
        await adminApi.apiV1AdminOrderGroupsResetPostRaw({
            resetOrderGroupsRequest: {
                targetDate: payload.targetDate
                    ? new Date(payload.targetDate)
                    : undefined,
                confirmation: payload.confirmation || null,
            },
        });
    }

    async generateManifest(batchId: string): Promise<void> {
        await adminApi.apiV1AdminOrderGroupsBatchIdManifestPostRaw({ batchId });
    }

    async assignBatchAgent(
        batchId: string,
        agentUserId: string
    ): Promise<void> {
        await adminApi.apiV1AdminOrderGroupsBatchIdAgentPostRaw({
            batchId,
            assignAgentRequest: { agentUserId },
        });
    }

    /** Full detail of a single order (for the batch-member drill-down). */
    async getOrder(orderId: string): Promise<AdminOrderDetail | null> {
        const res = await ordersApi.apiV1OrdersOrderIdGetRaw({ orderId });
        return unwrapData<AdminOrderDetail>(await parseJson(res.raw)) ?? null;
    }

    // -------------------------------------------------------------------
    // Orders (M5 — Admin sees and can cancel every restaurant's orders)
    // -------------------------------------------------------------------

    /** Every restaurant's orders, filterable — `GET /orders` (admin = no ownership scoping). */
    async getOrders(
        filters: AdminOrderListFilters = {}
    ): Promise<AdminOrdersResult> {
        const res = await ordersApi.apiV1OrdersGetRaw({
            restaurantId: filters.restaurantId || undefined,
            status: filters.status || undefined,
            from: filters.from ? new Date(filters.from) : undefined,
            to: filters.to ? new Date(filters.to) : undefined,
            // Only `createdAt:asc|desc` is accepted; see ORDER_SORT_OPTIONS.
            sort: filters.sort || undefined,
            page: filters.page,
            pageSize: filters.pageSize,
        });
        const body = await parseJson<unknown>(res.raw);
        const orders = extractList<AdminOrderDetail>(body);
        const p = extractPagination(body);
        return {
            orders,
            totalCount: p?.total ?? extractTotal(body) ?? orders.length,
            page: p?.page,
            pageSize: p?.pageSize,
        };
    }

    /**
     * Cancels any order regardless of owning restaurant (per
     * `PATCH /orders/{orderId}/cancel` doc: "Admin — any order in any
     * cancellable status"). Rejected with `ORDER_NOT_CANCELLABLE` (409) for
     * `processing` / `in_transit` / `delivered` orders.
     */
    async cancelOrder(orderId: string, reason?: string): Promise<void> {
        await ordersApi.apiV1OrdersOrderIdCancelPatchRaw({
            orderId,
            cancelOrderRequest: { reason: reason || undefined },
        });
    }

    /**
     * Records what was actually fulfilled for one order item (UC-ORD-16/17,
     * `PATCH /orders/{orderId}/items/{itemId}/actual-quantity`, RBAC
     * `admin,operations_manager`). Returns the re-read order so the caller can
     * render the recalculated totals instead of guessing them.
     *
     * The backend rejects `actualQuantity` outside `[0, item.quantity]` with
     * `INVALID_ACTUAL_QUANTITY` (422) and any draft/cancelled order with
     * `ORDER_CANNOT_ADJUST` (409) — both are mirrored client-side so the call
     * is only made when it can succeed.
     */
    async recordActualQuantity(
        orderId: string,
        orderItemId: string,
        actualQuantity: number
    ): Promise<AdminOrderDetail | null> {
        const res =
            await ordersApi.apiV1OrdersOrderIdItemsItemIdActualQuantityPatchRaw(
                {
                    orderId,
                    itemId: orderItemId,
                    recordActualQuantityRequest: { actualQuantity },
                }
            );
        return unwrapData<AdminOrderDetail>(await parseJson(res.raw)) ?? null;
    }

    /**
     * Advances a confirmed order one stage through the pre-hub pipeline
     * (`POST /orders/{orderId}/advance-status`, RBAC `admin,operations_manager`)
     * — the ops bridge for when the automatic flow stalls. `status` must be one
     * of `batched` / `picked_up` / `at_hub`; see `ORDER_ADVANCE_NEXT_STATUS`.
     */
    async advanceOrderStatus(
        orderId: string,
        status: string
    ): Promise<AdminOrderDetail | null> {
        const res = await ordersApi.apiV1OrdersOrderIdAdvanceStatusPostRaw({
            orderId,
            advanceOrderStatusRequest: { status },
        });
        return unwrapData<AdminOrderDetail>(await parseJson(res.raw)) ?? null;
    }

    async cancelOrderGroup(batchId: string, reason?: string): Promise<void> {
        await adminApi.apiV1AdminOrderGroupsBatchIdCancelPostRaw({
            batchId,
            cancelOrderGroupRequest: { reason: reason || null },
        });
    }

    // -------------------------------------------------------------------
    // Audit logs
    // -------------------------------------------------------------------

    async getAuditLogs(
        filters: AdminAuditLogFilters = {}
    ): Promise<AdminAuditLogsResult> {
        const res = await adminApi.apiV1AdminAuditLogsGetRaw({
            actorId: filters.actorId || undefined,
            action: filters.action || undefined,
            entityType: filters.entityType || undefined,
            from: filters.from ? new Date(filters.from) : undefined,
            to: filters.to ? new Date(filters.to) : undefined,
            page: filters.page,
            pageSize: filters.pageSize,
        });
        const body = await parseJson<unknown>(res.raw);
        const entries = extractList<AdminAuditLogRow>(body);
        const p = extractPagination(body);
        return {
            entries,
            totalCount: p?.total ?? extractTotal(body) ?? entries.length,
            page: p?.page,
            pageSize: p?.pageSize,
        };
    }

    // -------------------------------------------------------------------
    // Markets (for the market-assignment picker)
    // -------------------------------------------------------------------

    async getMarkets(): Promise<AdminMarketOption[]> {
        const res = await marketsApi.apiV1MarketsGetRaw({});
        const body = await parseJson<unknown>(res.raw);
        const entries = extractList<AdminMarketOption>(body);
        return entries.filter((m): m is AdminMarketOption => !!m?.id);
    }

    /** Hubs as `{ id, name }`, for resolving a batch's `hubId` to a name. */
    async getHubs(): Promise<{ id: string; name: string }[]> {
        const rows = await fetchAllCursor<Record<string, unknown>>(
            (cursor, pageSize) =>
                hubsApi
                    .apiV1HubsGetRaw({ cursor, pageSize })
                    .then((res) => res.raw)
        );
        return withId(rows, 'hubId')
            .map((hub) => ({ id: hub.id, name: String(hub['name'] ?? '') }))
            .filter((hub) => !!hub.id);
    }

    // -------------------------------------------------------------------
    // Invoices (financial oversight — natural read extension of M6 Credit)
    // -------------------------------------------------------------------

    async getInvoices(
        filters: AdminInvoiceFilters = {}
    ): Promise<AdminInvoicesResult> {
        const res = await invoicesApi.apiV1InvoicesGetRaw({
            restaurantId: filters.restaurantId || undefined,
            status: filters.status || undefined,
            page: filters.page,
            pageSize: filters.pageSize,
        });
        const body = await parseJson<unknown>(res.raw);
        const invoices = withId<AdminInvoiceRow>(
            extractList(body),
            'invoiceId'
        );
        const p = extractPagination(body);
        return {
            invoices,
            totalCount: p?.total ?? extractTotal(body) ?? invoices.length,
            page: p?.page,
            pageSize: p?.pageSize,
        };
    }

    /**
     * Batching progress for `date` (defaults to today), optionally narrowed by
     * batch status. PRD M7 gives Operations the monitoring view; the run
     * itself is `auto-batch`.
     */
    async getOrderGroupProgress(options?: {
        date?: Date;
        status?: string;
    }): Promise<AdminOrderGroupProgress | null> {
        const res = await adminApi.apiV1AdminOrderGroupsProgressGetRaw({
            date: options?.date,
            status: options?.status || undefined,
        });
        return (
            unwrapData<AdminOrderGroupProgress>(await parseJson(res.raw)) ??
            null
        );
    }

    async getInvoice(invoiceId: string): Promise<AdminInvoiceRow | null> {
        const res = await invoicesApi.apiV1InvoicesInvoiceIdGetRaw({
            invoiceId,
        });
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        const [row] = withId<AdminInvoiceRow>(
            [data as AdminInvoiceRow],
            'invoiceId'
        );
        return row?.id ? row : null;
    }

    /**
     * Downloads an issued invoice's persisted structured XML document
     * (`GET /invoices/{invoiceId}/export`).
     *
     * Uses `rawApi` because the checked-in client predates this endpoint, and
     * reads the body as a blob rather than JSON: the server answers
     * `application/xml` with a `Content-Disposition` filename, which the
     * envelope helpers would mangle into `undefined`.
     *
     * Returns the filename the server chose, falling back to the invoice id so
     * a response without the header still saves as something identifiable.
     */
    async exportInvoice(
        invoiceId: string
    ): Promise<{ blob: Blob; fileName: string }> {
        const res = await rawApi.send(
            `/api/v1/invoices/${invoiceId}/export`,
            'GET'
        );
        return {
            blob: await res.blob(),
            fileName:
                fileNameFromContentDisposition(
                    res.headers.get('content-disposition')
                ) ?? `invoice-${invoiceId}.xml`,
        };
    }
}

/**
 * Fills in the statement fields the wire shape does not carry.
 *
 * `CreditStatementSummaryDto` names its period by UTC boundaries and its
 * settlements by `totalSettlements`; the screens ask for `year` / `month` /
 * `totalPayments`. Reading the month off `periodStart` has to happen in
 * **Asia/Ho_Chi_Minh**, because that is the zone the boundary was computed in
 * (`CreditStatementPeriodCalculator`) — `periodStart` for January is
 * `2026-12-31T17:00:00Z`, which is December in every zone west of UTC+7.
 *
 * Existing values win, so a server that later sends these directly is untouched.
 */
function normalizeCreditStatement<T extends AdminCreditStatement>(row: T): T {
    const period = row.periodStart
        ? DateTime.fromISO(String(row.periodStart), { zone: 'utc' }).setZone(
              STATEMENT_TIME_ZONE
          )
        : null;
    return {
        ...row,
        year: row.year ?? (period?.isValid ? period.year : undefined),
        month: row.month ?? (period?.isValid ? period.month : undefined),
        totalPayments: row.totalPayments ?? row.totalSettlements,
    };
}

/**
 * Reads the filename out of a `Content-Disposition` header.
 *
 * Prefers RFC 5987 `filename*=UTF-8''…` when present — invoice names can carry
 * Vietnamese diacritics, and the plain `filename=` fallback is where servers
 * put an ASCII-mangled version of the same name.
 */
function fileNameFromContentDisposition(
    header: string | null
): string | undefined {
    if (!header) {
        return undefined;
    }
    const extended = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (extended) {
        try {
            return decodeURIComponent(extended[1].trim());
        } catch {
            // Malformed percent-encoding — fall through to the plain form.
        }
    }
    const plain = /filename="?([^";]+)"?/i.exec(header);
    return plain ? plain[1].trim() : undefined;
}

/**
 * Re-exported from the shared api layer, where it now also reads the typed
 * {@link ApiError} subclasses (401/403/5xx) — not just {@link ResponseError} —
 * so RBAC/permission rejections surface their backend reason too. Kept exported
 * here so existing `import { apiErrorMessage } from '../admin.service'` callers
 * are unaffected.
 */
export { apiErrorMessage } from 'app/core/api/envelope';
