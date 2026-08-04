import { inject, Injectable } from '@angular/core';
import { extractList, extractTotal, parseJson } from 'app/core/api/envelope';
import { invoicesApi, restaurantCreditApi } from 'contract';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';
import { FinanceInvoiceRow, RestaurantCreditRow } from './finance.types';

/** Restaurants fetched per page while building the portfolio. */
const RESTAURANT_PAGE_SIZE = 100;

/** Credit reads issued at once — enough to be quick, few enough to be polite. */
const CREDIT_CONCURRENCY = 6;

/**
 * The money view across **all** restaurants, for Operations.
 *
 * Every credit endpoint the backend offers is scoped to one restaurant
 * (`GET /restaurants/{restaurantId}/credit`) — there is no portfolio call — so
 * this composes one: list the restaurants, then fan out a bounded number of
 * credit reads and fold them into a table. That is a real cost (one request per
 * restaurant), which is why the concurrency is capped and a restaurant whose
 * read fails is kept in the table marked unavailable rather than dropped: a
 * missing row would silently understate what is owed.
 */
@Injectable({ providedIn: 'root' })
export class FinanceAdminService {
    private readonly _admin = inject(AdminService);

    /**
     * Credit position of every restaurant account.
     *
     * `approvedOnly` narrows to `active` restaurants — a pending account cannot
     * order yet, so it has no debt and only pads the table.
     */
    async creditPortfolio(
        approvedOnly = false
    ): Promise<RestaurantCreditRow[]> {
        const restaurants = await this._listRestaurants(approvedOnly);
        const rows: RestaurantCreditRow[] = [];

        for (let i = 0; i < restaurants.length; i += CREDIT_CONCURRENCY) {
            const slice = restaurants.slice(i, i + CREDIT_CONCURRENCY);
            const settled = await Promise.all(
                slice.map((user) => this._creditRow(user))
            );
            rows.push(...settled);
        }
        return rows;
    }

    /** Invoices across every restaurant, newest first as the API returns them. */
    async listInvoices(options?: {
        status?: string;
        restaurantId?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{ rows: FinanceInvoiceRow[]; total: number }> {
        const res = await invoicesApi.apiV1InvoicesGetRaw({
            status: options?.status || undefined,
            restaurantId: options?.restaurantId || undefined,
            page: options?.page ?? 1,
            pageSize: options?.pageSize ?? 20,
        });
        const body = await parseJson(res.raw);
        const rows = extractList<FinanceInvoiceRow>(body);
        return { rows, total: extractTotal(body) ?? rows.length };
    }

    private async _listRestaurants(
        approvedOnly: boolean
    ): Promise<AdminUserRow[]> {
        const { users } = await this._admin.getUsers({
            role: 'restaurant',
            restaurantStatus: approvedOnly ? 'active' : undefined,
            page: 1,
            pageSize: RESTAURANT_PAGE_SIZE,
        });
        return users.filter((user) => !!user.restaurantId);
    }

    private async _creditRow(user: AdminUserRow): Promise<RestaurantCreditRow> {
        const restaurantId = String(user.restaurantId);
        const base: RestaurantCreditRow = {
            id: restaurantId,
            userId: user.id,
            email: user.email ?? '',
            name: user.restaurantName || user.email || restaurantId,
            approvalStatus: user.restaurantStatus ?? null,
            creditLimit: null,
            outstanding: null,
            available: null,
            unavailable: false,
        };
        try {
            const res =
                await restaurantCreditApi.apiV1RestaurantsRestaurantIdCreditGetRaw(
                    { restaurantId }
                );
            const body = await parseJson<{
                data?: Record<string, unknown>;
            }>(res.raw);
            const d = (body?.data ?? body ?? {}) as Record<string, unknown>;
            return {
                ...base,
                creditLimit: num(d['creditLimit']),
                // The live field is `outstandingBalance`; `currentBalance` is
                // tolerated because the spec publishes no schema for this body.
                outstanding: num(
                    d['outstandingBalance'] ?? d['currentBalance']
                ),
                available: num(d['availableCredit']),
            };
        } catch {
            // Kept in the table: dropping it would quietly shrink the total.
            return { ...base, unavailable: true };
        }
    }
}

function num(value: unknown): number | null {
    if (value == null || value === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
