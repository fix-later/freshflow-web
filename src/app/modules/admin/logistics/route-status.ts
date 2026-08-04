/** Pill class for a route status — same lifecycle-coloring idiom used elsewhere. */
export function routeStatusPillClass(
    status: string | null | undefined
): string {
    switch (String(status ?? '').toLowerCase()) {
        case 'completed':
        case 'delivered':
            return 'admin-pill admin-pill-success';
        case 'cancelled':
        case 'failed':
            return 'admin-pill admin-pill-danger';
        case 'in_progress':
        case 'active':
        case 'dispatched':
            return 'admin-pill admin-pill-warning';
        case 'reviewed':
        case 'assigned':
            return 'admin-pill admin-pill-purple';
        case 'selected':
        case 'optimized':
            return 'admin-pill admin-pill-cyan';
        case 'draft':
        case 'planned':
        case 'calculated':
            return 'admin-pill admin-pill-info';
        default:
            return 'admin-pill admin-pill-neutral';
    }
}

/**
 * i18n key for a route status. Backend values are shown raw today — a driver
 * or operator reading "assigned" in a Vietnamese console is being handed the
 * database's vocabulary, not theirs.
 *
 * `ROUTE_STATUSES` is the documented set; anything outside it falls back to
 * `admin.routes.status.unknown` rather than rendering a missing-key string.
 */
export function routeStatusLabelKey(status: string | null | undefined): string {
    const normalized = String(status ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    return normalized
        ? `admin.routes.status.${normalized}`
        : 'admin.routes.status.unknown';
}

/**
 * i18n key for a route type. The live API answers `hub_relay` (Market → Hub →
 * Restaurant) and `direct` (Market → Restaurant) — the two shapes PRD M9
 * names.
 */
export function routeTypeLabelKey(type: string | null | undefined): string {
    const normalized = String(type ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    return normalized
        ? `admin.routes.type.${normalized}`
        : 'admin.routes.type.unknown';
}
