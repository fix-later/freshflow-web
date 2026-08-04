/**
 * Shapes for the order-claim review queue (`/api/v1/claims`).
 *
 * A claim is a restaurant's request for money back on a delivered order
 * (shortage / damage). Approving it refunds the amount against the
 * restaurant's B2B credit, so this is a financial decision, not a support
 * ticket — which is why only `admin` / `operations_manager` may decide one.
 *
 * These mirror the server's `OrderClaimDto`; the endpoints are absent from the
 * `openapi.json` snapshot, so there is no generated model to import yet.
 */

/**
 * Claim lifecycle. The wire format is lowercase (`OrderClaimStatus` is
 * `ToString().ToLowerInvariant()`-ed by `OrderClaimDtoMapper`), and the list
 * endpoint parses the `status` filter case-insensitively.
 */
export const CLAIM_STATUSES = ['submitted', 'approved', 'rejected'] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/**
 * The only status a decision may be made from. `OrderClaim.Approve` / `Reject`
 * answer `CLAIM_INVALID_TRANSITION` (409) for anything else — approving an
 * already-approved claim is the one tolerated no-op.
 */
export const CLAIM_DECIDABLE_STATUS: ClaimStatus = 'submitted';

/**
 * `DecisionNote` — `MaximumLength(1_000)` on both the approve and the reject
 * validator. Rejecting additionally requires it to be non-empty
 * (`RejectClaimCommandValidator.NotEmpty`, and again in the domain as
 * `INVALID_CLAIM_DECISION_NOTE`).
 */
export const CLAIM_DECISION_NOTE_MAX_LENGTH = 1000;

/** Largest `pageSize` `ListClaimsQueryValidator` accepts (`InclusiveBetween(1, 100)`). */
export const CLAIM_PAGE_SIZE = 50;

/** One claim as `GET /claims` / `GET /claims/{claimId}` returns it. */
export interface AdminClaimRow {
    /** Normalized by `withId(rows, 'claimId')`, so always present. */
    id: string;
    claimId?: string | null;
    orderId?: string | null;
    restaurantId?: string | null;
    amount?: number | null;
    reason?: string | null;
    status?: string | null;
    createdBy?: string | null;
    createdAt?: string | null;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    decisionNote?: string | null;
    /** Set once an approval has actually moved the credit. */
    refundTransactionId?: string | null;
    updatedAt?: string | null;
    [key: string]: unknown;
}

/** One cursor page of claims. */
export interface AdminClaimsPage {
    claims: AdminClaimRow[];
    nextCursor?: string;
}

/** Filters accepted by `GET /claims`. */
export interface AdminClaimFilters {
    restaurantId?: string;
    status?: ClaimStatus;
    cursor?: string;
}
