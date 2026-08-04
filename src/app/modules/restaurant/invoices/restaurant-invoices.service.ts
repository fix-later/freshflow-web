import { Injectable } from '@angular/core';
import {
    extractList,
    extractPagination,
    extractTotal,
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
}
