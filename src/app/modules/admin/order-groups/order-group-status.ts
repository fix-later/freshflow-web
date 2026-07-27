/**
 * Pill class per batch / member / order status, coloured along the lifecycle
 * (Built → Manifested → Purchasing → HandedOff → Completed, + Cancelled) so
 * statuses are easy to tell apart. Unknown statuses fall back to neutral.
 * Shared by the order-groups list and its detail page.
 */
export function statusPillClass(status: string | null | undefined): string {
    switch (String(status ?? '').toLowerCase()) {
        case 'completed':
        case 'dispatched':
            return 'admin-pill admin-pill-success';
        case 'cancelled':
            return 'admin-pill admin-pill-danger';
        case 'purchasing':
        case 'processing':
            return 'admin-pill admin-pill-warning';
        case 'manifested':
            return 'admin-pill admin-pill-purple';
        case 'handedoff':
            return 'admin-pill admin-pill-cyan';
        case 'built':
        case 'open':
        case 'locked':
            return 'admin-pill admin-pill-info';
        default:
            return 'admin-pill admin-pill-neutral';
    }
}
