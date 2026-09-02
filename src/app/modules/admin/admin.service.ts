import { Injectable } from '@angular/core';
import {
    extractList,
    extractPagination,
    extractTotal,
    fetchAllCursor,
    fileNameFromContentDisposition,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import { mapWithLimit } from 'app/core/util/concurrency';
import {
    adminApi,
    hubsApi,
    invoicesApi,
    marketsApi,
    ordersApi,
    procurementBatchOverviewApi,
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
    AdminBatchCostOverview,
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
    AdminMarketSession,
    AdminMarketSessionFilters,
    AdminMarketSessionResources,
    AdminMarketSessionTracking,
    AdminOperationalSettings,
    AdminOrderDetail,
    AdminOrderGroupRow,
    AdminOrderGroupsResult,
    AdminOrderListFilters,
    AdminOrdersResult,
    AdminResetOrderGroupsPayload,
    AdminRestaurantCredit,
    AdminRestaurantProfile,
    AdminRoleEntry,
    AdminSetCreditLimitPayload,
    AdminSettleCreditPayload,
    AdminUserFilters,
    AdminUserRow,
    AdminUsersResult,
    BatchSettlement,
} from './admin.types';
import {
    deriveBatchNumber,
    resolveBatchNumber,
} from './order-groups/order-group-batch-code';

/** Role eligible to be assigned a procurement batch (see ROLE_MATRIX). */
const MARKET_AGENT_ROLE = 'market_agent';

/** This legacy role has been folded into admin and must no longer be assigned. */
const OPERATIONS_MANAGER_ROLE = 'operations_manager';

/** `GetUsersQueryValidator` rejects anything above this (400). */
const MAX_USER_PAGE_SIZE = 100;

/** Stops a broken `total` from turning the walk into an endless loop. */
const MAX_USER_PAGES = 50;

/**
 * How many per-agent assignment reads are in flight at once.
 *
 * One request per agent is the only way to answer "who works this chợ", so on
 * a platform with a real roster this is the widest burst the admin console
 * makes. Paced, because the burst is what draws the 429 that used to empty the
 * whole answer.
 */
const ASSIGNMENT_READ_CONCURRENCY = 6;

/** A finite number from an untyped body, else `0`. */
function numberOf(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/** A non-empty trimmed string from an untyped body, else `null`. */
function stringOrNull(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text === '' ? null : text;
}

/**
 * Whether a batch's cost totals can be compared yet — see {@link BatchSettlement}.
 *
 * Read off the batch's own lifecycle (`Built → Manifested → Purchasing →
 * HandedOff → Completed`, or `Cancelled`), not off the line counts. Hand-off is
 * the point the server itself declares the shopping finished: `HandOff` is
 * refused with `BATCH_INCOMPLETE` until every non-exempt item has been bought,
 * so `HandedOff`/`Completed` is exactly "actualPurchaseTotal is now final".
 *
 * Counting lines instead (`itemsPurchased >= totalItemCount`) gets two cases
 * wrong: a line the agent reported *unavailable* is never bought, so such a
 * batch would sit at "still shopping" forever even after hand-off; and a batch
 * with no items at all would read as settled on `0 >= 0`.
 */
function batchSettlementOf(status: string | null): BatchSettlement {
    switch ((status ?? '').toLowerCase()) {
        case 'cancelled':
            return 'cancelled';
        case 'handedoff':
        case 'completed':
            return 'settled';
        default:
            return 'inProgress';
    }
}

/**
 * Every distinct agent the batch's items are assigned to, in the order the
 * items list them. A batch is shopped per product now, so this is a list —
 * usually of one, but nothing stops an admin splitting it between agents.
 */
function itemAgentIds(row: Record<string, unknown>): string[] {
    const items = row['items'];
    if (!Array.isArray(items)) {
        return [];
    }
    const ids = items
        .map((item) =>
            String(
                (item as Record<string, unknown>)?.['assignedAgentUserId'] ?? ''
            ).trim()
        )
        .filter((id) => !!id);
    return [...new Set(ids)];
}

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

    /**
     * Every user holding `role`, walking the pages.
     *
     * `GetUsersQueryValidator` caps `pageSize` at **100** and answers 400 for
     * anything larger, so a roster is read a page at a time rather than asked
     * for in one oversized call — which is what silently emptied the hub-staff
     * and driver lists.
     */
    async listUsersByRole(role: string): Promise<AdminUserRow[]> {
        return this.listUsers({ role });
    }

    /**
     * Every user matching the supplied filters, walking the server pages.
     * Used when the Web must order a complete review queue before paginating.
     */
    async listUsers(filters: AdminUserFilters = {}): Promise<AdminUserRow[]> {
        const all: AdminUserRow[] = [];
        for (let page = 1; page <= MAX_USER_PAGES; page++) {
            const result = await this.getUsers({
                ...filters,
                page,
                pageSize: MAX_USER_PAGE_SIZE,
            });
            all.push(...result.users);
            if (result.users.length < MAX_USER_PAGE_SIZE) {
                break;
            }
        }
        return all;
    }

    /** Display names by user id, fetched once. */
    private _userLabels?: Promise<Map<string, string>>;

    /**
     * User id → the name to print for them, memoised for the browsing session.
     *
     * Several oversight screens show what a member of staff did and have only
     * the id the record carries. Names change rarely and only the label is read
     * here, so the walk over the user pages is done once rather than per panel.
     * Falls back to an empty map: a screen that cannot name someone shows the
     * role it knows, never a spinner that never ends.
     */
    getUserLabels(): Promise<Map<string, string>> {
        return (this._userLabels ??= this.listUsers()
            .then(
                (users) =>
                    new Map(
                        users.map((user) => [
                            user.id,
                            user.fullName || user.email || user.id,
                        ])
                    )
            )
            .catch(() => new Map<string, string>()));
    }

    /**
     * Creates the account and answers its new id, which the caller needs to
     * follow up with an assignment the create endpoint does not cover (a
     * hub-staff roster, say). `null` when the response carries no id.
     */
    async createUser(payload: AdminCreateUserPayload): Promise<string | null> {
        const res = await adminApi.apiV1AdminUsersPostRaw({
            createUserCommand: payload,
        });
        const body = await parseJson<unknown>(res.raw);
        const created = unwrapData<Record<string, unknown>>(body);
        const id = created?.['id'] ?? created?.['userId'];
        return id ? String(id) : null;
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
     * builds marketId → agents. A market can be worked by several agents, so
     * each entry is a list; the order follows the agent list itself.
     *
     * Walks the pages: `GetUsersQuery` defaults to **20** per page, so asking
     * without one silently capped this at the first twenty agents — every agent
     * past that read as belonging to no chợ at all.
     *
     * There is no market→agents endpoint, so the assignments are one request
     * per agent. That fan-out used to be an unthrottled `Promise.all`, and
     * every caller wraps this whole method in a "then it's empty" catch — so a
     * single refused read (a 429 off the burst itself is enough) answered that
     * **no agent works any chợ**: the market's own roster came back empty and
     * the staff picker showed a dash where every agent's chợ should be. Now the
     * burst is paced, and an agent whose list cannot be read costs that agent's
     * entry rather than all of them.
     */
    async getMarketAgentsWithAssignments(): Promise<{
        agents: AdminUserRow[];
        agentsByMarket: Map<string, AdminUserRow[]>;
    }> {
        const users = await this.listUsersByRole(MARKET_AGENT_ROLE);
        const agents = users.filter((u) => !!u.id);
        const assignments = await mapWithLimit(
            agents,
            ASSIGNMENT_READ_CONCURRENCY,
            (agent) => this.getMarketAssignments(agent.id),
            []
        );
        const pairs = agents.map((agent, index) => ({
            agent,
            markets: assignments[index],
        }));
        const agentsByMarket = new Map<string, AdminUserRow[]>();
        for (const { agent, markets } of pairs) {
            for (const marketId of markets) {
                agentsByMarket.set(marketId, [
                    ...(agentsByMarket.get(marketId) ?? []),
                    agent,
                ]);
            }
        }
        return { agents, agentsByMarket };
    }

    /**
     * Resolves which market-agents hold each market, by reading every agent's
     * assignment list. There is no market→agents GET.
     */
    async getAgentsByMarketId(): Promise<Map<string, AdminUserRow[]>> {
        const { agentsByMarket } = await this.getMarketAgentsWithAssignments();
        return agentsByMarket;
    }

    /**
     * Makes exactly `agentUserIds` the agents of `marketId`.
     *
     * Assignments are stored per user (`PUT /admin/users/{id}/market-assignments`
     * replaces one agent's whole market list), so a market-side change is a diff:
     * each newly picked agent gains this market, each dropped agent loses it, and
     * everybody keeps the other markets they cover. Untouched agents are not
     * written at all.
     */
    async setMarketAgents(
        marketId: string,
        agentUserIds: string[],
        previousAgentIds: string[] = []
    ): Promise<void> {
        const next = new Set(agentUserIds);
        const previous = new Set(previousAgentIds);
        const added = [...next].filter((id) => !previous.has(id));
        const removed = [...previous].filter((id) => !next.has(id));

        for (const userId of added) {
            const markets = await this.getMarketAssignments(userId);
            if (!markets.includes(marketId)) {
                await this.replaceMarketAssignments(userId, [
                    ...markets,
                    marketId,
                ]);
            }
        }

        for (const userId of removed) {
            const markets = await this.getMarketAssignments(userId);
            await this.replaceMarketAssignments(
                userId,
                markets.filter((id) => id !== marketId)
            );
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
            .filter(
                (name): name is string =>
                    !!name &&
                    name.trim().toLowerCase() !== OPERATIONS_MANAGER_ROLE
            );
    }

    // -------------------------------------------------------------------
    // Restaurants
    // -------------------------------------------------------------------

    /**
     * The restaurant's full profile, including the legal/e-invoice fields the
     * user list does not carry (`GET /admin/restaurants/{id}/profile`).
     *
     * Answers 404 `RESTAURANT_NOT_FOUND` for an id that no longer exists.
     */
    async getRestaurantProfile(
        restaurantId: string
    ): Promise<AdminRestaurantProfile | null> {
        const res =
            await adminApi.apiV1AdminRestaurantsRestaurantIdProfileGetRaw({
                restaurantId,
            });
        return (
            unwrapData<AdminRestaurantProfile>(await parseJson(res.raw)) ?? null
        );
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

    /** Credit snapshot used to prefill the restaurant screen. */
    async getRestaurantCredit(
        restaurantId: string
    ): Promise<AdminRestaurantCredit | null> {
        const res =
            await restaurantCreditApi.apiV1RestaurantsRestaurantIdCreditGetRaw({
                restaurantId,
            });
        return (
            unwrapData<AdminRestaurantCredit>(await parseJson(res.raw)) ?? null
        );
    }

    /** Monthly credit statements, newest first. */
    async getCreditStatements(
        restaurantId: string
    ): Promise<AdminCreditStatement[]> {
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
        return withId<AdminCreditStatement>(rows, 'statementId').map((row) =>
            normalizeCreditStatement(row)
        );
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

    /** Credit ledger entries, newest first. */
    async getCreditTransactions(
        restaurantId: string
    ): Promise<AdminCreditTransaction[]> {
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
        return withId<AdminCreditTransaction>(rows, 'transactionId').map(
            (row) => ({
                ...row,
                description: row.description ?? row.note ?? null,
            })
        );
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

    // -------------------------------------------------------------------
    // Market sessions (ordering windows)
    // -------------------------------------------------------------------

    /**
     * Lists backend-generated sessions.
     *
     * This and the market-session calls below go through the authenticated raw
     * client — auth refresh, no-store and the typed error classes all still
     * apply. They predate the snapshot that now describes them: every one has
     * a generated counterpart on `adminApi` as of the 14/08/2026 regeneration,
     * and the set should move across together rather than one at a time.
     */
    async getMarketSessions(
        filters: AdminMarketSessionFilters = {}
    ): Promise<AdminMarketSession[]> {
        const query: Record<string, string> = {};
        if (filters.from) query['from'] = filters.from;
        if (filters.to) query['to'] = filters.to;
        if (filters.marketId) query['marketId'] = filters.marketId;
        if (filters.status) query['status'] = filters.status;
        const response = await rawApi.send(
            '/api/v1/admin/market-sessions',
            'GET',
            undefined,
            query
        );
        return withId<AdminMarketSession>(
            extractList(await parseJson(response)),
            'sessionId'
        );
    }

    async getMarketSession(id: string): Promise<AdminMarketSession> {
        const response = await rawApi.send(
            `/api/v1/admin/market-sessions/${encodeURIComponent(id)}`,
            'GET'
        );
        return this._requireMarketSession(response);
    }

    async getMarketSessionResources(
        id: string
    ): Promise<AdminMarketSessionResources> {
        const response = await rawApi.send(
            `/api/v1/admin/market-sessions/${encodeURIComponent(id)}/resource-options`,
            'GET'
        );
        const resources = unwrapData<AdminMarketSessionResources>(
            await parseJson(response)
        );
        if (!resources) {
            throw new Error('MARKET_SESSION_RESOURCES_RESPONSE_EMPTY');
        }
        return resources;
    }

    async configureMarketSessionResources(
        id: string,
        resources: {
            plannedCapacityKg: number | null;
            vehicleIds: string[];
            agentUserIds: string[];
        }
    ): Promise<AdminMarketSessionResources> {
        const response = await rawApi.send(
            `/api/v1/admin/market-sessions/${encodeURIComponent(id)}/resources`,
            'PUT',
            resources
        );
        const updated = unwrapData<AdminMarketSessionResources>(
            await parseJson(response)
        );
        if (!updated) {
            throw new Error('MARKET_SESSION_RESOURCES_RESPONSE_EMPTY');
        }
        return updated;
    }

    async updateMarketSessionCloseTime(
        id: string,
        closesAt: string
    ): Promise<AdminMarketSession> {
        const response = await rawApi.send(
            `/api/v1/admin/market-sessions/${encodeURIComponent(id)}`,
            'PUT',
            { closesAt }
        );
        return this._requireMarketSession(response);
    }

    /** Opens a draft session. The backend re-checks live readiness atomically. */
    async openMarketSession(id: string): Promise<AdminMarketSession> {
        const response = await rawApi.send(
            `/api/v1/admin/market-sessions/${encodeURIComponent(id)}/open`,
            'POST'
        );
        return this._requireMarketSession(response);
    }

    async closeMarketSession(
        id: string,
        reason: string | null = null
    ): Promise<AdminMarketSession> {
        const response = await rawApi.send(
            `/api/v1/admin/market-sessions/${encodeURIComponent(id)}/close`,
            'POST',
            { reason }
        );
        return this._requireMarketSession(response);
    }

    async getMarketSessionTracking(
        id: string,
        page = 1,
        pageSize = 50
    ): Promise<AdminMarketSessionTracking> {
        const tracking = await this._requestMarketSessionTracking(
            id,
            page,
            pageSize
        );
        const normalizedTracking: AdminMarketSessionTracking = {
            ...tracking,
            summary: {
                ...tracking.summary,
                subtotalAmount: Number(
                    tracking.summary.subtotalAmount ??
                        tracking.summary.merchandiseAmount ??
                        0
                ),
                totalAmount: Number(
                    tracking.summary.totalAmount ??
                        tracking.summary.grandTotal ??
                        0
                ),
            },
        };
        const orders = normalizedTracking.orders.map((order) =>
            this._normalizeTrackingOrderFinancials(order)
        );
        const activePageOrders = orders.filter(
            (order) => order.status.toLowerCase() !== 'cancelled'
        );
        const summaryNeedsFallback =
            !Number.isFinite(Number(normalizedTracking.summary.totalAmount)) ||
            !Number.isFinite(
                Number(normalizedTracking.summary.subtotalAmount)
            ) ||
            (Number(normalizedTracking.summary.totalAmount ?? 0) === 0 &&
                activePageOrders.some((order) => order.totalAmount > 0)) ||
            (Number(normalizedTracking.summary.subtotalAmount ?? 0) === 0 &&
                activePageOrders.some((order) => order.subtotalAmount > 0));

        let financialOrders = orders;
        if (
            summaryNeedsFallback &&
            normalizedTracking.ordersPagination.total > orders.length
        ) {
            const aggregatePageSize = 100;
            const pageCount = Math.ceil(
                normalizedTracking.ordersPagination.total / aggregatePageSize
            );
            const pages = await Promise.all(
                Array.from({ length: pageCount }, (_, index) =>
                    this._requestMarketSessionTracking(
                        id,
                        index + 1,
                        aggregatePageSize
                    )
                )
            );
            const uniqueOrders = new Map(
                pages
                    .flatMap((result) => result.orders)
                    .map((order) => [
                        order.orderId,
                        this._normalizeTrackingOrderFinancials(order),
                    ])
            );
            financialOrders = [...uniqueOrders.values()];
        }

        if (!summaryNeedsFallback) {
            return { ...normalizedTracking, orders };
        }
        const activeOrders = financialOrders.filter(
            (order) => order.status.toLowerCase() !== 'cancelled'
        );
        const sum = (
            selector: (
                order: AdminMarketSessionTracking['orders'][number]
            ) => number | null | undefined
        ): number =>
            activeOrders.reduce(
                (total, order) => total + Number(selector(order) ?? 0),
                0
            );
        const derivedDeliveryFee = sum((order) => order.deliveryFee);
        return {
            ...normalizedTracking,
            orders,
            summary: {
                ...normalizedTracking.summary,
                subtotalAmount: sum((order) => order.subtotalAmount),
                vatAmount: sum((order) => order.vatAmount),
                deliveryFee:
                    derivedDeliveryFee > 0
                        ? derivedDeliveryFee
                        : Number(normalizedTracking.summary.deliveryFee ?? 0),
                totalAmount: sum((order) => order.totalAmount),
            },
        };
    }

    private async _requestMarketSessionTracking(
        id: string,
        page: number,
        pageSize: number
    ): Promise<AdminMarketSessionTracking> {
        const response = await rawApi.send(
            `/api/v1/admin/market-sessions/${encodeURIComponent(id)}/tracking`,
            'GET',
            undefined,
            { page: String(page), pageSize: String(pageSize) }
        );
        const tracking = unwrapData<AdminMarketSessionTracking>(
            await parseJson(response)
        );
        if (!tracking) {
            throw new Error('MARKET_SESSION_TRACKING_RESPONSE_EMPTY');
        }
        return tracking;
    }

    private _normalizeTrackingOrderFinancials(
        order: AdminMarketSessionTracking['orders'][number]
    ): AdminMarketSessionTracking['orders'][number] {
        const itemSubtotal = (order.items ?? []).reduce(
            (total, item) => total + Number(item.subtotal ?? 0),
            0
        );
        const storedSubtotal = Number(order.subtotalAmount ?? 0);
        const subtotalAmount =
            storedSubtotal > 0 ? storedSubtotal : itemSubtotal;
        const vatAmount = Number(order.vatAmount ?? 0);
        const deliveryFee = Number(order.deliveryFee ?? 0);
        const storedTotal = Number(order.totalAmount ?? 0);
        return {
            ...order,
            subtotalAmount,
            vatAmount,
            deliveryFee,
            totalAmount:
                storedTotal > 0
                    ? storedTotal
                    : subtotalAmount + vatAmount + deliveryFee,
        };
    }

    private async _requireMarketSession(
        response: Response
    ): Promise<AdminMarketSession> {
        const session = unwrapData<AdminMarketSession>(
            await parseJson(response)
        );
        if (!session) {
            throw new Error('MARKET_SESSION_RESPONSE_EMPTY');
        }
        return session;
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
     * The money side of one phiên chợ
     * (`GET /procurement/batches/{batchId}/overview`).
     *
     * `null` when the batch has no overview to read — a 404, or a body this
     * cannot make sense of. The two totals default to `0` rather than
     * `undefined` because they are summed: a backend that has not yet shipped
     * `restaurantOrderTotal` / `actualPurchaseTotal` (added in
     * `feat(procurement): expose purchase cost totals`) then reads as "nothing
     * recorded", not as `NaN` propagating through every figure on the card.
     */
    async getBatchCostOverview(
        batchId: string
    ): Promise<AdminBatchCostOverview | null> {
        const res =
            await procurementBatchOverviewApi.apiV1ProcurementBatchesBatchIdOverviewGetRaw(
                { batchId }
            );
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        // `totalItemCount` is what `ProcurementBatchOverviewDto` calls it; the
        // shorter spelling is only a guard against the name being normalised
        // somewhere between here and the DTO.
        const status = stringOrNull(data['status']);
        return {
            batchId: String(data['batchId'] ?? data['id'] ?? batchId),
            batchCode: stringOrNull(data['batchCode'] ?? data['code']),
            batchDate: stringOrNull(data['batchDate']),
            marketName: stringOrNull(data['marketName']),
            status,
            restaurantOrderTotal: numberOf(data['restaurantOrderTotal']),
            actualPurchaseTotal: numberOf(data['actualPurchaseTotal']),
            itemCount: numberOf(data['totalItemCount'] ?? data['itemCount']),
            itemsPurchased: numberOf(data['itemsPurchased']),
            settlement: batchSettlementOf(status),
        };
    }

    /**
     * Cost overviews for the most recent phiên chợ, oldest first so they chart
     * left-to-right through time.
     *
     * There is no list endpoint for this: the overview is per batch, so the
     * batch list is read first and one overview fetched per row. `limit` caps
     * that fan-out — the chart stops being readable past a couple of dozen
     * points long before the request count becomes a problem.
     *
     * Each overview fails on its own. One batch the server cannot summarise
     * drops a point rather than emptying the chart.
     */
    async getPurchaseCostTrend(limit = 20): Promise<AdminBatchCostOverview[]> {
        const { groups } = await this.getOrderGroups(1, limit);
        const overviews = await Promise.all(
            groups
                .filter((group) => !!group.id)
                .map((group) =>
                    this.getBatchCostOverview(group.id!)
                        .then((overview) =>
                            overview
                                ? {
                                      ...overview,
                                      // The list resolved these; the overview
                                      // may not carry them.
                                      batchCode:
                                          overview.batchCode ??
                                          group.batchNumber ??
                                          null,
                                      batchDate:
                                          overview.batchDate ??
                                          group.targetDate ??
                                          null,
                                      marketName:
                                          overview.marketName ??
                                          group.marketName ??
                                          null,
                                  }
                                : null
                        )
                        .catch(() => null)
                )
        );
        return overviews
            .filter(
                (overview): overview is AdminBatchCostOverview => !!overview
            )
            .sort((a, b) =>
                String(a.batchDate ?? '').localeCompare(
                    String(b.batchDate ?? '')
                )
            );
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
                // Who is shopping this batch now lives on its items;
                // `assignedAgentUserId` on the batch is deprecated server-side
                // and no longer written, so it is read last rather than first.
                agentId:
                    row.agentId ??
                    itemAgentIds(row)[0] ??
                    (row['assignedAgentUserId'] as string | null) ??
                    (row['AssignedAgentUserId'] as string | null) ??
                    null,
                agentIds: itemAgentIds(row),
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
     * A single batch by id, from `GET /admin/order-groups/{batchId}` (BE commit
     * "Add admin procurement batch detail endpoint"). It answers the same
     * `ProcurementBatchDto` as the list, so the row carries full detail —
     * items / members / exceptions — and goes through the same normalisation.
     *
     * Falls back to scanning the list for a backend that predates the endpoint;
     * without that a 404 would break the batch detail page against an older API.
     */
    async getOrderGroup(batchId: string): Promise<AdminOrderGroupRow | null> {
        try {
            const res = await adminApi.apiV1AdminOrderGroupsBatchIdGetRaw({
                batchId,
            });
            const data = unwrapData<Record<string, unknown>>(
                await parseJson(res.raw)
            );
            if (data) {
                const [row] = withId<AdminOrderGroupRow>(
                    [data as AdminOrderGroupRow],
                    'batchId',
                    'BatchId',
                    'procurementBatchId'
                );
                const [normalized] = await this._normalizeOrderGroups([row]);
                return normalized ?? null;
            }
        } catch {
            // Older backend, or the batch is not readable this way — scan below.
        }
        return this._findOrderGroupInList(batchId);
    }

    private async _findOrderGroupInList(
        batchId: string
    ): Promise<AdminOrderGroupRow | null> {
        const pageSize = 100;
        let page = 1;
        let loaded = 0;
        let total = Number.POSITIVE_INFINITY;
        while (loaded < total) {
            const result = await this.getOrderGroups(page, pageSize);
            const match = result.groups.find((group) => group.id === batchId);
            if (match) return match;
            loaded += result.groups.length;
            total = result.totalCount;
            if (!result.groups.length) break;
            page += 1;
        }
        return null;
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

    /**
     * Assigns the batch's line items to market agents
     * (`PUT /admin/batches/{batchId}/item-assignments`).
     *
     * This replaced `POST /admin/order-groups/{batchId}/agent`, which put one
     * agent on the whole batch: a batch is now shopped per product, so who buys
     * what is recorded per item and `ProcurementBatch.AssignedAgentUserId` is
     * marked deprecated server-side. An `agentUserId` of
     * `00000000-0000-0000-0000-000000000000` unassigns that item.
     *
     * The command refuses the batch unless it is `manifested` or `purchasing`,
     * refuses a product that is not in it or already bought, and refuses an
     * agent who is not an active agent of the batch's chợ (and, when the batch
     * belongs to a market session, not assigned to that session).
     */
    async assignBatchItems(
        batchId: string,
        assignments: { marketProductId: string; agentUserId: string }[]
    ): Promise<void> {
        await adminApi.apiV1AdminBatchesBatchIdItemAssignmentsPutRaw({
            batchId,
            assignBatchItemsRequest: { assignments },
        });
    }

    /** Full detail of a single order (for the batch-member drill-down). */
    async getOrder(orderId: string): Promise<AdminOrderDetail | null> {
        const res = await ordersApi.apiV1OrdersOrderIdGetRaw({ orderId });
        return unwrapData<AdminOrderDetail>(await parseJson(res.raw)) ?? null;
    }

    /** Order reads already answered this session, keyed by order id. */
    private readonly _settledOrders = new Map<
        string,
        Promise<AdminOrderDetail | null>
    >();

    /**
     * {@link getOrder} for an order that has finished moving, memoised for the
     * browsing session.
     *
     * `OrdersController` is rate limited — 30 requests a minute per user, with
     * no queue (`RateLimiting:Orders`) — and the completed-session board reads
     * one order per line of every session on it. Without this, walking into a
     * session's detail and back re-read the same forty orders inside the same
     * minute and the second half came back 429.
     *
     * Only for orders whose figures no longer change (delivered / cancelled):
     * anything that shows a live status must call {@link getOrder} instead.
     * A failed read is not remembered, so a retry is a real retry.
     */
    getSettledOrder(orderId: string): Promise<AdminOrderDetail | null> {
        let request = this._settledOrders.get(orderId);
        if (!request) {
            request = this.getOrder(orderId).catch((err: unknown) => {
                this._settledOrders.delete(orderId);
                throw err;
            });
            this._settledOrders.set(orderId, request);
        }
        return request;
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
     * Reads the raw response rather than the parsed body: the server answers
     * `application/xml` with a `Content-Disposition` filename, which the
     * envelope helpers would mangle into `undefined`.
     *
     * Returns the filename the server chose, falling back to the invoice id so
     * a response without the header still saves as something identifiable.
     */
    async exportInvoice(
        invoiceId: string
    ): Promise<{ blob: Blob; fileName: string }> {
        const { raw } = await invoicesApi.apiV1InvoicesInvoiceIdExportGetRaw({
            invoiceId,
        });
        return {
            blob: await raw.blob(),
            fileName:
                fileNameFromContentDisposition(
                    raw.headers.get('content-disposition')
                ) ?? `invoice-${invoiceId}.xml`,
        };
    }

    /**
     * Downloads a **sandbox** invoice as its rendered PDF draft
     * (`GET /invoices/{invoiceId}/pdf`).
     *
     * Same raw-response handling as {@link exportInvoice}: `application/pdf`
     * with a `Content-Disposition` name, which the envelope helpers would
     * mangle.
     *
     * Only sandbox invoices render here. A provider-issued one answers 422
     * `INVOICE_PDF_PROVIDER_REQUIRED` — the legal document is the provider's
     * file, not something this app may re-render — which the caller surfaces
     * through the mapped message rather than swallowing.
     */
    async downloadInvoicePdf(
        invoiceId: string
    ): Promise<{ blob: Blob; fileName: string }> {
        const { raw } = await invoicesApi.apiV1InvoicesInvoiceIdPdfGetRaw({
            invoiceId,
        });
        return {
            blob: await raw.blob(),
            fileName:
                fileNameFromContentDisposition(
                    raw.headers.get('content-disposition')
                ) ?? `invoice-${invoiceId}.pdf`,
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
 * Re-exported from the shared api layer, where it now also reads the typed
 * {@link ApiError} subclasses (401/403/5xx) — not just {@link ResponseError} —
 * so RBAC/permission rejections surface their backend reason too. Kept exported
 * here so existing `import { apiErrorMessage } from '../admin.service'` callers
 * are unaffected.
 */
export { apiErrorMessage } from 'app/core/api/envelope';
