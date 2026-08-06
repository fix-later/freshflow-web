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
 * The lifecycle, the row shape and the page size are the same on both sides of
 * the desk, so they live with the module that owns claims on the backend
 * (Orders) and are re-exported here — a second copy of the status vocabulary is
 * how the two screens end up disagreeing about what "submitted" is called.
 */
export {
    CLAIM_PAGE_SIZE,
    CLAIM_STATUSES,
    type ClaimStatus,
} from 'app/modules/orders/claims.types';
import type { ClaimRow, ClaimStatus } from 'app/modules/orders/claims.types';

/** The reviewer's view of a claim. Identical to the filer's, so far. */
export type AdminClaimRow = ClaimRow;

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
