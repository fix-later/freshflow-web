/** One invoice row (`GET /invoices`). Untyped in the spec. */
export interface InvoiceRow {
    id: string;
    restaurantId?: string | null;
    restaurantName?: string | null;
    status?: string | null;
    totalAmount?: number | null;
    issuedAt?: string | null;
    dueAt?: string | null;
    [key: string]: unknown;
}

export interface InvoicesResult {
    invoices: InvoiceRow[];
    totalCount: number;
    page?: number;
    pageSize?: number;
}

export interface InvoicesFilters {
    status?: string;
    page?: number;
    pageSize?: number;
}
