/** Web-surface roles (RBAC is server-authoritative; this mirrors the JWT `role`). */
export type UserRole = 'restaurant' | 'admin' | 'operations_manager';

/** Restaurant approval lifecycle (BR-AUTH-1). */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * Maps the API's lifecycle vocabulary onto {@link ApprovalStatus}.
 *
 * `GET /restaurants/me/approval-status` answers `pending` | `active` |
 * `suspended` — the same values the admin `restaurantStatus` filter takes.
 * None of them is the word "approved", so matching on the client vocabulary
 * alone sent every approved restaurant down the fallback and left it gated as
 * pending forever.
 *
 * `suspended` folds into `rejected` on purpose: both must block ordering, and
 * `rejected` is the copy that does not promise ordering will resume.
 */
export function toApprovalStatus(
    raw: string | null | undefined
): ApprovalStatus {
    switch ((raw ?? '').trim().toLowerCase()) {
        case 'active':
        case 'approved':
            return 'approved';
        case 'suspended':
        case 'rejected':
            return 'rejected';
        default:
            return 'pending';
    }
}

export interface User {
    id: string;
    email: string;
    role: UserRole;
    /** Display name — falls back to email; consumed by the Fuse user menu. */
    name?: string;
    fullName?: string | null;
    phone?: string | null;
    /** Avatar URL — consumed by the Fuse user menu (`avatar`). */
    avatar?: string;
    avatarUrl?: string | null;
    /** Fuse presence status (online/away/busy), unrelated to approval. */
    status?: string;
    /** Restaurant-only: approval state gating ordering actions (BR-AUTH-1). */
    approvalStatus?: ApprovalStatus;
}
