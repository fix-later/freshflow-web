import { Injectable } from '@angular/core';
import {
    extractList,
    extractNextCursor,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import { rawApi } from 'contract';
import {
    AdminClaimFilters,
    AdminClaimRow,
    AdminClaimsPage,
    CLAIM_PAGE_SIZE,
} from './claims.types';

/**
 * Order-claim review (`/api/v1/claims`) for the admin console.
 *
 * Every call goes through `rawApi`: the claims routes exist on the backend but
 * are missing from the `openapi.json` snapshot, so no generated client method
 * covers them yet. `rawApi` still applies the shared configuration — bearer
 * auth, the no-store cache policy, 401 refresh-and-retry and the typed error
 * classes — so failures read exactly like a generated call's and
 * `describeApiError` can localize them. Replace with the generated methods once
 * `npm run generate:api` catches up.
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
        const res = await rawApi.send('/api/v1/claims', 'GET', undefined, {
            restaurantId: filters.restaurantId || undefined,
            status: filters.status || undefined,
            cursor: filters.cursor || undefined,
            pageSize: CLAIM_PAGE_SIZE,
        });
        const body = await parseJson(res);
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
        const res = await rawApi.send(
            `/api/v1/claims/${encodeURIComponent(claimId)}`,
            'GET'
        );
        return this._claimOf(await parseJson(res));
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
        const res = await rawApi.send(
            `/api/v1/claims/${encodeURIComponent(claimId)}/approve`,
            'PATCH',
            { decisionNote: decisionNote?.trim() || null }
        );
        return this._claimOf(await parseJson(res));
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
        const res = await rawApi.send(
            `/api/v1/claims/${encodeURIComponent(claimId)}/reject`,
            'PATCH',
            { decisionNote: decisionNote.trim() }
        );
        return this._claimOf(await parseJson(res));
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
