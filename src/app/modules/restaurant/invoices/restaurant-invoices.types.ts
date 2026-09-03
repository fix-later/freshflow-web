/**
 * One line of a VAT invoice (`InvoiceLineDto`). Quantities and money arrive as
 * decimals.
 */
export interface InvoiceLine {
    productName?: string | null;
    unit?: string | null;
    quantity?: number | null;
    unitPrice?: number | null;
    vatRateCode?: string | null;
    vatRatePercent?: number | null;
    lineSubtotal?: number | null;
    lineVatAmount?: number | null;
    lineTotal?: number | null;
    [key: string]: unknown;
}

/**
 * One invoice (`GET /invoices`, `GET /invoices/{id}`).
 *
 * The list answers `InvoiceSummaryDto` and the detail `InvoiceDto`, which is
 * the summary plus the buyer block, the tax figures and `lines` — so the extra
 * fields are optional here rather than a second type nothing could narrow.
 * Untyped in the OpenAPI spec, which is why these are read defensively.
 */
export interface InvoiceRow {
    id: string;
    orderId?: string | null;
    restaurantId?: string | null;
    restaurantName?: string | null;
    status?: string | null;
    /** Provider's series and running number, once it has issued the invoice. */
    serial?: string | null;
    number?: string | null;
    taxAuthorityCode?: string | null;
    lookupUrl?: string | null;
    buyerTaxCode?: string | null;
    buyerLegalName?: string | null;
    buyerAddress?: string | null;
    buyerEmail?: string | null;
    subTotal?: number | null;
    vatAmount?: number | null;
    total?: number | null;
    /** Kept: the list has historically been read for this name too. */
    totalAmount?: number | null;
    issuedAt?: string | null;
    dueAt?: string | null;
    createdAt?: string | null;
    providerName?: string | null;
    isSandbox?: boolean | null;
    /** Why the provider has not issued it yet, e.g. `BUYER_TAX_CODE_REQUIRED`. */
    errorReason?: string | null;
    retryCount?: number | null;
    lines?: InvoiceLine[];
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
