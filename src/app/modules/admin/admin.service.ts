import { Injectable } from '@angular/core';
import {
    adminApi,
    marketsApi,
    ResponseError,
    restaurantCreditApi,
} from 'contract';
import {
    AdminCreateUserPayload,
    AdminMarketAssignmentEntry,
    AdminMarketOption,
    AdminRestaurantCredit,
    AdminRoleEntry,
    AdminSetCreditLimitPayload,
    AdminSettleCreditPayload,
    AdminUserFilters,
    AdminUserRow,
    AdminUsersResult,
} from './admin.types';

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
        const users = extractList<AdminUserRow>(body);
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

/** Parses a JSON body, tolerating an empty (`void`) response. */
async function parseJson<T>(response: Response): Promise<T | undefined> {
    const text = await response.text();
    if (!text) {
        return undefined;
    }
    try {
        return JSON.parse(text) as T;
    } catch {
        return undefined;
    }
}

/**
 * Returns the first array found in an untyped list response, guaranteeing an
 * array so consumers (and `@for`) never receive a non-iterable value.
 *
 * Handles a bare array, common envelope keys (`items`/`data`/`results`/`value`)
 * and one level of nesting (e.g. a .NET `Result<T>` shape
 * `{ data: { items: [...] } }`). Unknown shapes degrade to an empty list.
 */
function extractList<T>(body: unknown): T[] {
    if (Array.isArray(body)) {
        return body as T[];
    }
    if (!body || typeof body !== 'object') {
        return [];
    }
    const record = body as Record<string, unknown>;
    for (const key of ['items', 'data', 'results', 'value']) {
        if (Array.isArray(record[key])) {
            return record[key] as T[];
        }
    }
    if (record['data'] && typeof record['data'] === 'object') {
        return extractList<T>(record['data']);
    }
    return [];
}

/** Reads a total-count value from a list envelope, if the backend sends one. */
function extractTotal(body: unknown): number | undefined {
    if (!body || typeof body !== 'object') {
        return undefined;
    }
    const record = body as Record<string, unknown>;
    for (const key of ['totalCount', 'total', 'totalItems', 'count']) {
        if (typeof record[key] === 'number') {
            return record[key] as number;
        }
    }
    if (record['data'] && typeof record['data'] === 'object') {
        return extractTotal(record['data']);
    }
    return undefined;
}
