/** Pill class for an invoice status — mirrors the admin invoices list's coloring. */
export function invoiceStatusPillClass(
    status: string | null | undefined
): string {
    switch (String(status ?? '').toLowerCase()) {
        case 'paid':
        case 'settled':
            return 'admin-pill admin-pill-success';
        case 'overdue':
        case 'cancelled':
        case 'void':
            return 'admin-pill admin-pill-danger';
        case 'pending':
        case 'issued':
            return 'admin-pill admin-pill-warning';
        case 'draft':
            return 'admin-pill admin-pill-info';
        default:
            return 'admin-pill admin-pill-neutral';
    }
}
