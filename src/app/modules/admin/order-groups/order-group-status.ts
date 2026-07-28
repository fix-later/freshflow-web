/**
 * Pill class per batch / member / order status, coloured along the lifecycle
 * (Built → Manifested → Purchasing → HandedOff → Completed, + Cancelled) so
 * statuses are easy to tell apart. Unknown statuses fall back to neutral.
 * Shared by the order-groups list and its detail page.
 */
export function statusPillClass(status: string | null | undefined): string {
    switch (statusKey(status)) {
        case 'completed':
        case 'dispatched':
        case 'delivered':
            return 'admin-pill admin-pill-success';
        case 'cancelled':
            return 'admin-pill admin-pill-danger';
        case 'purchasing':
        case 'processing':
        case 'delivering':
        case 'pickedup':
            return 'admin-pill admin-pill-warning';
        case 'manifested':
            return 'admin-pill admin-pill-purple';
        case 'handedoff':
        case 'athub':
            return 'admin-pill admin-pill-cyan';
        case 'built':
        case 'open':
        case 'locked':
        case 'confirmed':
        case 'batched':
            return 'admin-pill admin-pill-info';
        case 'draft':
            return 'admin-pill admin-pill-neutral';
        default:
            return 'admin-pill admin-pill-neutral';
    }
}

/** Lowercased status token used for pills / i18n keys. */
export function statusKey(status: string | null | undefined): string {
    const normalized = String(status ?? '')
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
    switch (normalized) {
        case 'handed_off':
            return 'handedoff';
        case 'at_hub':
            return 'athub';
        case 'picked_up':
            return 'pickedup';
        default:
            return normalized;
    }
}

/**
 * Transloco key for a known batch/member status, or null when the raw value
 * should be shown as-is.
 */
export function statusLabelKey(
    status: string | null | undefined
): string | null {
    const key = statusKey(status);
    return key ? `admin.orderGroups.status.${key}` : null;
}

/**
 * Generating a manifest only makes sense before purchasing starts — at Built
 * (creates it) or Manifested (regenerates it).
 */
export function canGenerateManifest(
    status: string | null | undefined
): boolean {
    const key = statusKey(status);
    return key === 'built' || key === 'manifested';
}

/** Terminal states in which a batch can no longer be cancelled. */
export function canCancelBatch(status: string | null | undefined): boolean {
    const key = statusKey(status);
    return key !== 'completed' && key !== 'cancelled';
}
