/** Restaurant credit/debt snapshot (`GET /restaurants/{id}/credit`). Untyped in the spec. */
export interface RestaurantCreditBalance {
    creditLimit?: number;
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
