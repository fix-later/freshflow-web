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

/** A monthly credit statement row (`GET .../credit/statements`). Untyped in the spec. */
export interface CreditStatement {
    id: string;
    year?: number;
    month?: number;
    openingBalance?: number;
    closingBalance?: number;
    totalCharges?: number;
    totalPayments?: number;
    generatedAt?: string;
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
