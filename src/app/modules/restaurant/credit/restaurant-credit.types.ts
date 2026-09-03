/** Restaurant credit/debt snapshot (`GET /restaurants/{id}/credit`). Untyped in the spec. */
export interface RestaurantCreditBalance {
    creditLimit?: number;
    /**
     * What the restaurant owes. The API spells this `outstandingBalance`;
     * `currentBalance` is kept as a tolerated alias because these types are
     * read defensively, but the live field is the first one.
     */
    outstandingBalance?: number;
    currentBalance?: number;
    availableCredit?: number;
    [key: string]: unknown;
}

/** One movement inside a statement (`CreditStatementLineDto`). */
export interface CreditStatementLine {
    transactionId?: string;
    type?: string;
    amount?: number;
    balanceAfter?: number;
    occurredAt?: string;
    note?: string | null;
    reference?: string | null;
    orderId?: string | null;
    paymentMethod?: string | null;
    [key: string]: unknown;
}

/**
 * A monthly credit statement (`GET .../credit/statements`, and the detail).
 *
 * The period is a **date range**, not a year/month pair: the backend closes a
 * statement over `periodStart`…`periodEnd` in Asia/Ho_Chi_Minh. Reading it as
 * `month/year` printed an empty "/" on every row.
 */
export interface CreditStatement {
    id: string;
    restaurantId?: string;
    periodStart?: string;
    periodEnd?: string;
    openingBalance?: number;
    closingBalance?: number;
    totalCharges?: number;
    /** Payments the restaurant made against its debt. */
    totalSettlements?: number;
    totalRefunds?: number;
    generatedAt?: string;
    dueDate?: string;
    /** Only the detail carries these; the list answers the summary. */
    lines?: CreditStatementLine[];
    [key: string]: unknown;
}

/** A single credit ledger entry (`GET .../credit/transactions`). Untyped in the spec. */
export interface CreditTransaction {
    id: string;
    createdAt?: string;
    type?: string;
    amount?: number;
    balanceAfter?: number;
    description?: string;
    reference?: string;
    [key: string]: unknown;
}
