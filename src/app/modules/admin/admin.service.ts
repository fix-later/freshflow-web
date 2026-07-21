import { Injectable } from '@angular/core';
import {
    extractList,
    extractTotal,
    MAX_PAGE_SIZE,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import {
    adminApi,
    marketsApi,
    ResponseError,
    restaurantCreditApi,
} from 'contract';
import {
    AdminAuditLogFilters,
    AdminAuditLogRow,
    AdminAuditLogsResult,
    AdminAutoBatchPayload,
    AdminCreateUserPayload,
    AdminMarketAssignmentEntry,
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
        const totalCount = extractTotal(body) ?? users.length;
        return { users, totalCount };
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
        const entries = extractList<AdminMarketAssignmentEntry>(body);
        return entries
            .map((entry) =>
                typeof entry === 'string' ? entry : entry.marketId ?? entry.id
            )
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
        pageSize = 25
    ): Promise<AdminOrderGroupsResult> {
        const res = await adminApi.apiV1AdminOrderGroupsGetRaw({
            page,
            pageSize,
        });
        const body = await parseJson<unknown>(res.raw);
        // Batch routes use {batchId}; the list may key it either way.
        const groups = withId<AdminOrderGroupRow>(extractList(body), 'batchId');
        return { groups, totalCount: extractTotal(body) ?? groups.length };
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
    async runAutoBatch(payload: AdminAutoBatchPayload = {}): Promise<unknown> {
        const res = await adminApi.apiV1AdminOrderGroupsAutoBatchPostRaw({
            runAutoBatchRequest: {
                targetDate: payload.targetDate
                    ? new Date(payload.targetDate)
                    : null,
                dryRun: payload.dryRun ?? null,
                force: payload.force ?? null,
            },
        });
        return unwrapData<unknown>(await parseJson(res.raw));
    }

    /** Market-agent users, for the "assign agent" picker on a batch. */
    async getAgentOptions(): Promise<AdminUserRow[]> {
        const { users } = await this.getUsers({
            role: MARKET_AGENT_ROLE,
            isActive: true,
            pageSize: MAX_PAGE_SIZE,
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
        return { entries, totalCount: extractTotal(body) ?? entries.length };
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
 * Extracts a human-readable message from a failed API call.
 *
 * Backend errors surface as a {@link ResponseError} whose `response` carries an
 * RFC 7807 `ProblemDetails` body (`detail`/`title`, or a `errors` validation
 * map). Returns `undefined` for non-HTTP failures so callers can fall back to a
 * generic translated message.
 */
export async function apiErrorMessage(
    err: unknown
): Promise<string | undefined> {
    if (!(err instanceof ResponseError)) {
        return undefined;
    }
    const body = await parseJson<Record<string, unknown>>(err.response.clone());
    if (!body) {
        return undefined;
    }
    if (body['errors'] && typeof body['errors'] === 'object') {
        const messages = Object.values(
            body['errors'] as Record<string, unknown>
        )
            .flatMap((v) => (Array.isArray(v) ? v : [v]))
            .filter((v): v is string => typeof v === 'string');
        if (messages.length) {
            return messages.join(' ');
        }
    }
    for (const key of ['detail', 'title', 'message']) {
        if (typeof body[key] === 'string' && body[key]) {
            return body[key] as string;
        }
    }
    return undefined;
}
