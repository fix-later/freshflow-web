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
import { adminApi, marketsApi, restaurantCreditApi } from 'contract';
import {
    AdminAuditLogFilters,
    AdminAuditLogRow,
    AdminAuditLogsResult,
    AdminAutoBatchPayload,
    AdminAutoBatchResult,
    AdminCreateUserPayload,
    AdminCreditStatement,
    AdminCreditTransaction,
    AdminGenerateStatementPayload,
    AdminMarketOption,
    AdminOperationalSettings,
    AdminOrderGroupRow,
    AdminOrderGroupsResult,
    AdminPricingSettings,
    AdminRestaurantCredit,
    AdminRoleEntry,
    AdminSetCreditLimitPayload,
    AdminSettleCreditPayload,
    AdminUserFilters,
    AdminUserRow,
    AdminUsersResult,
} from './admin.types';

/** Role eligible to be assigned a procurement batch (see ROLE_MATRIX). */
const MARKET_AGENT_ROLE = 'market_agent';

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
            return (await parseJson<AdminRestaurantCredit>(res.raw)) ?? null;
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
            return withId<AdminCreditStatement>(rows, 'statementId');
        } catch {
            return [];
        }
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
        pageSize = 10
    ): Promise<AdminOrderGroupsResult> {
        const res = await adminApi.apiV1AdminOrderGroupsGetRaw({
            page,
            pageSize,
        });
        const body = await parseJson<unknown>(res.raw);
        // Batch routes use {batchId}; the list may key it either way.
        const groups = withId<AdminOrderGroupRow>(extractList(body), 'batchId');
        const p = extractPagination(body);
        return {
            groups,
            totalCount: p?.total ?? extractTotal(body) ?? groups.length,
            page: p?.page,
            pageSize: p?.pageSize,
        };
    }

    /** Live batching progress for a day, optionally narrowed to one status. */
    async getOrderGroupProgress(
        date?: string,
        status?: string
    ): Promise<AdminOrderGroupRow[]> {
        const res = await adminApi.apiV1AdminOrderGroupsProgressGetRaw({
            date: date ? new Date(date) : undefined,
            status: status || undefined,
        });
        return withId<AdminOrderGroupRow>(
            extractList(await parseJson(res.raw)),
            'batchId'
        );
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
        return unwrapData<AdminAutoBatchResult>(await parseJson(res.raw)) ?? {};
    }

    /** Market-agent users, for the "assign agent" picker on a batch. */
    async getAgentOptions(): Promise<AdminUserRow[]> {
        const { users } = await this.getUsers({
            role: MARKET_AGENT_ROLE,
            isActive: true,
        });
        return users.filter((user) => !!user.id);
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
}

/**
 * Re-exported from the shared api layer, where it now also reads the typed
 * {@link ApiError} subclasses (401/403/5xx) — not just {@link ResponseError} —
 * so RBAC/permission rejections surface their backend reason too. Kept exported
 * here so existing `import { apiErrorMessage } from '../admin.service'` callers
 * are unaffected.
 */
export { apiErrorMessage } from 'app/core/api/envelope';
