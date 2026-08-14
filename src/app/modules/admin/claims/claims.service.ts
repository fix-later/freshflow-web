import { Injectable } from '@angular/core';
import {
    extractList,
    extractNextCursor,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import { claimsApi } from 'contract';
import {
    AdminClaimFilters,
    AdminClaimRow,
    AdminClaimsPage,
    CLAIM_PAGE_SIZE,
} from './claims.types';

/**
 * Order-claim review (`/api/v1/claims`) for the admin console.
 *
 * RBAC: the controller is `admin,operations_manager,restaurant`, and
 * approve/reject narrow to `admin,operations_manager`. Admin is "privileged",
 * so listing is not scoped to one restaurant unless `restaurantId` is passed.
 */
@Injectable({ providedIn: 'root' })
export class ClaimsService {
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
        return {
            claims: withId<AdminClaimRow>(
                extractList(body),
                'claimId'
            ) as AdminClaimRow[],
            nextCursor: extractNextCursor(body),
        };
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
        return this._claimOf(await parseJson(res.raw));
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
        return this._claimOf(await parseJson(res.raw));
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
        return this._claimOf(await parseJson(res.raw));
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
}
