import { Injectable, inject } from '@angular/core';
import {
    extractList,
    extractNextCursor,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import { mapWithLimit } from 'app/core/util/concurrency';
import { claimsApi } from 'contract';
import { AdminService } from '../admin.service';
import type { AdminOrderDetail, AdminUserRow } from '../admin.types';
import {
    AdminClaimFilters,
    AdminClaimParty,
    AdminClaimRow,
    AdminClaimsPage,
    CLAIM_PAGE_SIZE,
    claimPartyOf,
} from './claims.types';

const ENRICHMENT_CONCURRENCY = 6;

/**
 * Order-claim review (`/api/v1/claims`) for the admin console.
 *
 * RBAC: the controller is `admin,operations_manager,restaurant`, and
 * approve/reject narrow to `admin,operations_manager`. Admin is "privileged",
 * so listing is not scoped to one restaurant unless `restaurantId` is passed.
 */
@Injectable({ providedIn: 'root' })
export class ClaimsService {
    private readonly _orderCache = new Map<
        string,
        Promise<AdminOrderDetail | null>
    >();
    private _usersPromise: Promise<AdminUserRow[]> | null = null;

    constructor(private readonly _admin: AdminService = inject(AdminService)) {}

    /** One cursor page of claims, newest first. */
    async listClaims(
        filters: AdminClaimFilters = {}
    ): Promise<AdminClaimsPage> {
        const res = await claimsApi.apiV1ClaimsGetRaw({
            restaurantId: filters.restaurantId || undefined,
            status: filters.status || undefined,
            cursor: filters.cursor || undefined,
            pageSize: CLAIM_PAGE_SIZE,
        });
        const body = await parseJson(res.raw);
        const claims = withId<AdminClaimRow>(
            extractList(body),
            'claimId'
        ) as AdminClaimRow[];
        return {
            claims: await this._enrich(claims),
            nextCursor: extractNextCursor(body),
        };
    }

    /** Restaurant choices for the readable filter on the review queue. */
    async listRestaurants(): Promise<AdminClaimParty[]> {
        const users = await this._users();
        return users
            .filter((user) => !!user.restaurantId)
            .map(claimPartyOf)
            .sort((left, right) => left.name.localeCompare(right.name, 'vi'));
    }

    /**
     * One claim, read fresh by id (`GET /claims/{claimId}`).
     *
     * The queue is a shared desk: by the time an operator opens a row, another
     * reviewer may already have decided it. Re-reading before showing the detail
     * is what keeps the decision buttons honest — the list row is a snapshot
     * from whenever the page was last loaded, this is the current state.
     *
     * Answers 404 `CLAIM_NOT_FOUND` for an unknown id (which is also what an id
     * typed into the lookup box gets when it belongs to nothing).
     */
    async getClaim(claimId: string): Promise<AdminClaimRow | null> {
        const res = await claimsApi.apiV1ClaimsClaimIdGetRaw({ claimId });
        return this._enrichedClaim(await parseJson(res.raw));
    }

    /**
     * Approves a claim and refunds its amount against the restaurant's credit.
     *
     * `decisionNote` is optional (max 1000 chars). Beyond the claim's own
     * state, this can still be refused by the credit service —
     * `CREDIT_REFUND_EXCEEDS_ORDER_CHARGE` / `CREDIT_REFUND_EXCEEDS_BALANCE`
     * (422) — because the refund is what actually moves money.
     */
    async approveClaim(
        claimId: string,
        decisionNote?: string
    ): Promise<AdminClaimRow | null> {
        const res = await claimsApi.apiV1ClaimsClaimIdApprovePatchRaw({
            claimId,
            approveClaimRequest: {
                decisionNote: decisionNote?.trim() || null,
            },
        });
        return this._enrichedClaim(await parseJson(res.raw));
    }

    /**
     * Rejects a claim. `decisionNote` is **required** here — the restaurant is
     * told why, so both `RejectClaimCommandValidator` and the domain
     * (`INVALID_CLAIM_DECISION_NOTE`) refuse a blank one.
     */
    async rejectClaim(
        claimId: string,
        decisionNote: string
    ): Promise<AdminClaimRow | null> {
        const res = await claimsApi.apiV1ClaimsClaimIdRejectPatchRaw({
            claimId,
            rejectClaimRequest: { decisionNote: decisionNote.trim() },
        });
        return this._enrichedClaim(await parseJson(res.raw));
    }

    /** Parses a single-claim envelope into a row with a usable `id`. */
    private _claimOf(body: unknown): AdminClaimRow | null {
        const data = unwrapData<Record<string, unknown>>(body);
        if (!data) {
            return null;
        }
        const [row] = withId<AdminClaimRow>([data as AdminClaimRow], 'claimId');
        return row?.id ? (row as AdminClaimRow) : null;
    }

    private async _enrichedClaim(body: unknown): Promise<AdminClaimRow | null> {
        const claim = this._claimOf(body);
        return claim ? (await this._enrich([claim]))[0] ?? null : null;
    }

    /**
     * Resolves claim foreign keys without making one failed order/user read
     * blank the queue. Order reads are paced and cached because cursor pages
     * can contain up to fifty claims.
     */
    private async _enrich(
        claims: readonly AdminClaimRow[]
    ): Promise<AdminClaimRow[]> {
        const [users, withOrders] = await Promise.all([
            this._users(),
            mapWithLimit(
                claims,
                ENRICHMENT_CONCURRENCY,
                async (claim) => ({
                    ...claim,
                    orderDetail: claim.orderId
                        ? await this._order(claim.orderId)
                        : null,
                }),
                null
            ),
        ]);
        const usersById = new Map(users.map((user) => [user.id, user]));
        const restaurantsById = new Map(
            users
                .filter((user) => !!user.restaurantId)
                .map((user) => [String(user.restaurantId), user])
        );

        return claims.map((claim, index) => {
            const withOrder = withOrders[index] ?? claim;
            const restaurant = claim.restaurantId
                ? restaurantsById.get(claim.restaurantId)
                : undefined;
            const filedBy = claim.createdBy
                ? usersById.get(claim.createdBy)
                : undefined;
            const reviewedBy = claim.reviewedBy
                ? usersById.get(claim.reviewedBy)
                : undefined;
            return {
                ...withOrder,
                restaurant: restaurant ? claimPartyOf(restaurant) : null,
                filedBy: filedBy ? claimPartyOf(filedBy) : null,
                reviewedByUser: reviewedBy ? claimPartyOf(reviewedBy) : null,
            };
        });
    }

    private _users(): Promise<AdminUserRow[]> {
        this._usersPromise ??= this._admin.listUsers().catch(() => []);
        return this._usersPromise;
    }

    private _order(orderId: string): Promise<AdminOrderDetail | null> {
        let request = this._orderCache.get(orderId);
        if (!request) {
            request = this._admin.getOrder(orderId).catch(() => null);
            this._orderCache.set(orderId, request);
        }
        return request;
    }
}
