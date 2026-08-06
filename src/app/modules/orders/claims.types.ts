/**
 * Order claims (`/api/v1/claims`) — the vocabulary both sides of the desk use.
 *
 * A claim is a restaurant asking for money back on an order it has received
 * (shortage / damage). The restaurant files it; `admin` / `operations_manager`
 * decide it, and an approval refunds against the restaurant's B2B credit. The
 * backend keeps claims inside the Orders module, so the shared shapes live
 * here — `modules/admin/claims` adds the reviewer-only pieces on top, and
 * `modules/restaurant/claims` the filer's.
 *
 * The endpoints are absent from the `openapi.json` snapshot, so there is no
 * generated model to import yet; these mirror `OrderClaimDto`.
 */

/**
 * Claim lifecycle. Lowercase on the wire — `OrderClaimDtoMapper` sends
 * `Status.ToString().ToLowerInvariant()`.
 */
export const CLAIM_STATUSES = ['submitted', 'approved', 'rejected'] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/**
 * Order statuses a claim may be filed against (`FileClaimCommandHandler`:
 * `AtHub or Delivered`, else `CLAIM_ORDER_NOT_CLAIMABLE`). Normalized spelling,
 * matching `normalizeOrderStatus`.
 */
export const CLAIM_ELIGIBLE_ORDER_STATUSES = ['at_hub', 'delivered'] as const;

/** `FileClaimCommandValidator.Reason` — `NotEmpty().MaximumLength(500)`. */
export const CLAIM_REASON_MAX_LENGTH = 500;

/** Largest `pageSize` `ListClaimsQueryValidator` accepts (`InclusiveBetween(1, 100)`). */
export const CLAIM_PAGE_SIZE = 50;

/** One claim as `GET /claims` / `GET /claims/{claimId}` returns it. */
export interface ClaimRow {
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

/** Lowercased status, or `null` when the row carries none we recognise. */
export function normalizeClaimStatus(
    status: string | null | undefined
): ClaimStatus | null {
    const value = (status ?? '').trim().toLowerCase();
    return (CLAIM_STATUSES as readonly string[]).includes(value)
        ? (value as ClaimStatus)
        : null;
}

/** Pill classes per status, matching the admin queue's colours. */
export function claimStatusPillClass(
    status: string | null | undefined
): string {
    switch (normalizeClaimStatus(status)) {
        case 'approved':
            return 'admin-pill admin-pill-success';
        case 'rejected':
            return 'admin-pill admin-pill-danger';
        case 'submitted':
            return 'admin-pill admin-pill-warning';
        default:
            return 'admin-pill admin-pill-neutral';
    }
}
