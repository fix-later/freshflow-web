/**
 * Pill classes for the states the money screens show.
 *
 * The order lifecycle already has {@link orderStatusPillClass}; these are the
 * ones beside it — what a ledger entry is, and whether an order is paid for.
 * Same idiom throughout: green means settled, red means owed or failed, amber
 * means waiting, and anything unrecognised stays neutral rather than borrowing
 * a colour it has not earned.
 */

/** Normalizes `PendingIssuance` / `partially-paid` to `pending_issuance`. */
function normalize(value: string | null | undefined): string {
    return String(value ?? '')
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}

/**
 * A credit ledger entry: `charge` | `settlement` | `refund` | `adjustment`.
 *
 * A charge is money the restaurant now owes, so it reads as the debt colour; a
 * settlement is that debt cleared.
 */
export function creditTypePillClass(type: string | null | undefined): string {
    switch (normalize(type)) {
        case 'settlement':
            return 'admin-pill admin-pill-success';
        case 'charge':
            return 'admin-pill admin-pill-warning';
        case 'refund':
            return 'admin-pill admin-pill-info';
        case 'adjustment':
            return 'admin-pill admin-pill-indigo';
        default:
            return 'admin-pill admin-pill-neutral';
    }
}

/** An order's payment state (`OrderDto.PaymentStatus`). */
export function paymentStatusPillClass(
    status: string | null | undefined
): string {
    switch (normalize(status)) {
        case 'paid':
            return 'admin-pill admin-pill-success';
        case 'partially_paid':
        case 'partiallypaid':
            return 'admin-pill admin-pill-teal';
        case 'outstanding':
        case 'unpaid':
            return 'admin-pill admin-pill-warning';
        case 'failed':
            return 'admin-pill admin-pill-danger';
        case 'refunded':
            return 'admin-pill admin-pill-purple';
        case 'pending':
            return 'admin-pill admin-pill-info';
        default:
            return 'admin-pill admin-pill-neutral';
    }
}

/** An e-invoice's issuing state (`admin.finance.invoiceStatus.*`). */
export function invoiceStatusPillClass(
    status: string | null | undefined
): string {
    switch (normalize(status)) {
        case 'issued':
            return 'admin-pill admin-pill-success';
        case 'pending_issuance':
        case 'pendingissuance':
            return 'admin-pill admin-pill-warning';
        case 'cancelled':
            return 'admin-pill admin-pill-danger';
        default:
            return 'admin-pill admin-pill-neutral';
    }
}
