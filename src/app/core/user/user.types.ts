/** Web-surface roles (RBAC is server-authoritative; this mirrors the JWT `role`). */
export type UserRole = 'restaurant' | 'admin' | 'operations_manager';

/** Restaurant approval lifecycle (BR-AUTH-1). */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

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
