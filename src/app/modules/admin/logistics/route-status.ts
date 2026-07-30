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
