/**
 * Finance shapes for the Operations money view.
 *
 * The credit endpoints publish no response schema, so the service parses them
 * defensively and normalises into these — the screen never touches a raw body.
 */

/** One restaurant's credit position in the portfolio table. */
export interface RestaurantCreditRow {
    /** The **restaurant** id — not the user id; the credit endpoints take this. */
    id: string;
    /** The owning user, for linking to the restaurant detail page. */
    userId: string;
    email: string;
    name: string;
    approvalStatus: string | null;
    creditLimit: number | null;
    /** What the restaurant owes right now (`outstandingBalance`). */
    outstanding: number | null;
    available: number | null;
    /** True when this restaurant's credit read failed — figures unknown. */
    unavailable: boolean;
}

/** A row of `GET /invoices`, as the live API returns it. */
export interface FinanceInvoiceRow {
    id?: string;
    orderId?: string;
    restaurantId?: string;
    status?: string;
    number?: string | null;
    taxAuthorityCode?: string | null;
    issuedAt?: string | null;
    total?: number;
    createdAt?: string;
    [key: string]: unknown;
}

/**
 * Portfolio totals. Restaurants whose credit read failed are counted in
 * `unavailable` and excluded from the sums — a total that silently omitted
 * them would read as "we are owed less than we are".
 */
export interface CreditTotals {
    limit: number;
    outstanding: number;
    available: number;
    /** Restaurants at or above their limit — ordering is already blocked. */
    atLimit: number;
    /** Restaurants past the warning threshold but still under the limit. */
    nearLimit: number;
    unavailable: number;
}

/**
 * Share of the limit used, above which a restaurant is flagged as approaching
 * it. BR-CRE-2 requires an alert "as the balance nears/exceeds" the limit but
 * does not fix the point; 80% is this screen's reading of "nears" and is the
 * only number here not taken from the API or the spec.
 */
export const CREDIT_WARNING_RATIO = 0.8;

/** Utilisation as a fraction of the limit, or `null` when it cannot be known. */
export function creditUtilisation(row: RestaurantCreditRow): number | null {
    if (row.unavailable || row.creditLimit == null || row.outstanding == null) {
        return null;
    }
    // A zero limit with debt is fully used; a zero limit with no debt is not a
    // division we can do, and is not a risk either.
    if (row.creditLimit === 0) {
        return row.outstanding > 0 ? 1 : 0;
    }
    return row.outstanding / row.creditLimit;
}

/** Risk banding used for the row's pill and for sorting. */
export function creditRisk(
    row: RestaurantCreditRow
): 'unavailable' | 'atLimit' | 'nearLimit' | 'ok' {
    if (row.unavailable) {
        return 'unavailable';
    }
    const used = creditUtilisation(row);
    if (used == null) {
        return 'unavailable';
    }
    if (used >= 1) {
        return 'atLimit';
    }
    return used >= CREDIT_WARNING_RATIO ? 'nearLimit' : 'ok';
}

export function creditTotals(
    rows: readonly RestaurantCreditRow[]
): CreditTotals {
    const totals: CreditTotals = {
        limit: 0,
        outstanding: 0,
        available: 0,
        atLimit: 0,
        nearLimit: 0,
        unavailable: 0,
    };
    for (const row of rows) {
        const risk = creditRisk(row);
        if (risk === 'unavailable') {
            totals.unavailable += 1;
            continue;
        }
        totals.limit += row.creditLimit ?? 0;
        totals.outstanding += row.outstanding ?? 0;
        totals.available += row.available ?? 0;
        if (risk === 'atLimit') {
            totals.atLimit += 1;
        } else if (risk === 'nearLimit') {
            totals.nearLimit += 1;
        }
    }
    return totals;
}

/** Riskiest first, then by debt — the order an operator wants to work in. */
export function byRisk(a: RestaurantCreditRow, b: RestaurantCreditRow): number {
    const rank = { atLimit: 0, nearLimit: 1, ok: 2, unavailable: 3 } as const;
    const diff = rank[creditRisk(a)] - rank[creditRisk(b)];
    return diff !== 0 ? diff : (b.outstanding ?? 0) - (a.outstanding ?? 0);
}
