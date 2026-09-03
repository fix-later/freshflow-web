import { Injectable } from '@angular/core';
import {
    extractList,
    extractPagination,
    extractTotal,
    fileNameFromContentDisposition,
    MAX_PAGE_SIZE,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import { invoicesApi } from 'contract';
import {
    InvoiceRow,
    InvoicesFilters,
    InvoicesResult,
} from './restaurant-invoices.types';

/** How far back the order index looks before giving up (pages of 100). */
const INVOICE_INDEX_PAGES = 3;

/**
 * The signed-in restaurant's own invoices (`GET /invoices`, `GET
 * /invoices/{invoiceId}`). No `restaurantId` is sent — ownership is scoped
 * server-side by the bearer token, same as `OrdersService`.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantInvoicesService {
    async listInvoices(filters: InvoicesFilters = {}): Promise<InvoicesResult> {
        const res = await invoicesApi.apiV1InvoicesGetRaw({
            status: filters.status || undefined,
            page: filters.page,
            // Anything above the cap answers 400, which would surface as an
            // empty page rather than an error the user can act on.
            pageSize: filters.pageSize
                ? Math.min(filters.pageSize, MAX_PAGE_SIZE)
                : undefined,
        });
        const body = await parseJson<unknown>(res.raw);
        const invoices = withId<InvoiceRow>(extractList(body), 'invoiceId');
        const p = extractPagination(body);
        return {
            invoices,
            totalCount: p?.total ?? extractTotal(body) ?? invoices.length,
            page: p?.page,
            pageSize: p?.pageSize,
        };
    }

    /**
     * The invoices covering `orderIds`, keyed by order.
     *
     * `GET /invoices` takes no order filter, so this reads the restaurant's
     * own invoices newest-first and indexes what it finds. Bounded on purpose:
     * it answers "which of these orders has an invoice I can show", and a
     * missing entry means "not in the recent window", never "no invoice
     * exists" — nothing here tells a restaurant it has none.
     */
    async invoicesByOrder(
        orderIds: readonly string[]
    ): Promise<Map<string, InvoiceRow>> {
        const wanted = new Set(orderIds.filter(Boolean));
        const found = new Map<string, InvoiceRow>();
        if (!wanted.size) {
            return found;
        }
        for (let page = 1; page <= INVOICE_INDEX_PAGES; page++) {
            const { invoices } = await this.listInvoices({
                page,
                pageSize: MAX_PAGE_SIZE,
            });
            for (const invoice of invoices) {
                const orderId = String(invoice.orderId ?? '');
                if (wanted.has(orderId) && !found.has(orderId)) {
                    found.set(orderId, invoice);
                }
            }
            if (found.size === wanted.size || invoices.length < MAX_PAGE_SIZE) {
                break;
            }
        }
        return found;
    }

    async getInvoice(invoiceId: string): Promise<InvoiceRow | null> {
        const res = await invoicesApi.apiV1InvoicesInvoiceIdGetRaw({
            invoiceId,
        });
        const data = unwrapData<InvoiceRow>(await parseJson(res.raw));
        if (!data) {
            return null;
        }
        return withId([data], 'invoiceId')[0];
    }

    /**
     * Downloads an invoice's e-invoice XML (`GET /invoices/{invoiceId}/export`).
     *
     * Open to the restaurant, not just the admin console
     * (`InvoicesController` — `admin,operations_manager,restaurant`): the XML is
     * the machine-readable document the restaurant's own accounting software
     * takes, so the list it reads its debt on is where it belongs.
     */
    async exportInvoice(
        invoiceId: string
    ): Promise<{ blob: Blob; fileName: string }> {
        const { raw } = await invoicesApi.apiV1InvoicesInvoiceIdExportGetRaw({
            invoiceId,
        });
        return {
            blob: await raw.blob(),
            fileName:
                fileNameFromContentDisposition(
                    raw.headers.get('content-disposition')
                ) ?? `invoice-${invoiceId}.xml`,
        };
    }

    /**
     * Downloads one of the restaurant's own invoices as a PDF
     * (`GET /invoices/{invoiceId}/pdf`). Ownership is enforced server-side, so
     * an invoice belonging to someone else answers 404 rather than leaking.
     *
     * Reads the raw response: the body is `application/pdf` with a
     * `Content-Disposition` name, not the `{ success, data }` envelope the
     * other calls here parse.
     *
     * The backend only renders **sandbox** invoices — a provider-issued one is
     * a legal document whose PDF must come from that provider, and answers 422
     * `INVOICE_PDF_PROVIDER_REQUIRED`. The caller shows that reason.
     */
    async downloadInvoicePdf(
        invoiceId: string
    ): Promise<{ blob: Blob; fileName: string }> {
        const { raw } = await invoicesApi.apiV1InvoicesInvoiceIdPdfGetRaw({
            invoiceId,
        });
        return {
            blob: await raw.blob(),
            fileName:
                fileNameFromContentDisposition(
                    raw.headers.get('content-disposition')
                ) ?? `invoice-${invoiceId}.pdf`,
        };
    }
}
