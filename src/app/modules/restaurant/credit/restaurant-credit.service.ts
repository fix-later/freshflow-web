import { Injectable, inject } from '@angular/core';
import {
    extractList,
    extractNextCursor,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import { RestaurantProfileService } from 'app/modules/restaurant/restaurant-profile.service';
import { restaurantCreditApi } from 'contract';
import {
    CreditStatement,
    CreditTransaction,
    RestaurantCreditBalance,
} from './restaurant-credit.types';

/**
 * The signed-in restaurant's own credit/debt balance, statements, and
 * transaction ledger. `RestaurantCreditApi` requires an explicit
 * `restaurantId` (no "me" variant), resolved from
 * `GET /restaurants/me/profile` — **not** from the signed-in user's id, which
 * is a different id and answers 404 here.
 *
 * Mostly reads, with one write: closing a billing month into a statement is
 * open to the restaurant that owns it, not only to an admin — this file used
 * to say otherwise, and the credit page had no way to ask for last month's
 * statement because of it.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantCreditService {
    private readonly _profileService = inject(RestaurantProfileService);

    async getBalance(): Promise<RestaurantCreditBalance | null> {
        const restaurantId = await this._restaurantId();
        const res =
            await restaurantCreditApi.apiV1RestaurantsRestaurantIdCreditGetRaw({
                restaurantId,
            });
        return (
            unwrapData<RestaurantCreditBalance>(await parseJson(res.raw)) ??
            null
        );
    }

    async listTransactions(cursor?: string): Promise<{
        transactions: CreditTransaction[];
        nextCursor?: string;
    }> {
        const restaurantId = await this._restaurantId();
        const res =
            await restaurantCreditApi.apiV1RestaurantsRestaurantIdCreditTransactionsGetRaw(
                { restaurantId, cursor, pageSize: 20 }
            );
        const body = await parseJson<unknown>(res.raw);
        const transactions = withId<CreditTransaction>(
            extractList(body),
            'transactionId'
        );
        return { transactions, nextCursor: extractNextCursor(body) };
    }

    async listStatements(cursor?: string): Promise<{
        statements: CreditStatement[];
        nextCursor?: string;
    }> {
        const restaurantId = await this._restaurantId();
        const res =
            await restaurantCreditApi.apiV1RestaurantsRestaurantIdCreditStatementsGetRaw(
                { restaurantId, cursor, pageSize: 20 }
            );
        const body = await parseJson<unknown>(res.raw);
        const statements = withId<CreditStatement>(
            extractList(body),
            'statementId'
        );
        return { statements, nextCursor: extractNextCursor(body) };
    }

    /**
     * Closes the statement for one billing month and returns it
     * (`POST .../credit/statements/generate`).
     *
     * Open to the restaurant itself, not only to an admin
     * (`GenerateStatementAsync`: "Admin or the owning restaurant"), and
     * idempotent — asking again for a month that already has one hands back the
     * same immutable statement rather than a second copy.
     */
    async generateStatement(
        year: number,
        month: number
    ): Promise<CreditStatement | null> {
        const restaurantId = await this._restaurantId();
        const res =
            await restaurantCreditApi.apiV1RestaurantsRestaurantIdCreditStatementsGeneratePostRaw(
                { restaurantId, generateStatementRequest: { year, month } }
            );
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        return data
            ? withId<CreditStatement>(
                  [data as CreditStatement],
                  'statementId'
              )[0]
            : null;
    }

    /**
     * One statement in full. The list response carries only the summary
     * figures, so this is what backs the breakdown a restaurant expands to see
     * how a closing balance was reached — without downloading the PDF.
     */
    async getStatement(statementId: string): Promise<CreditStatement | null> {
        const restaurantId = await this._restaurantId();
        const res =
            await restaurantCreditApi.apiV1RestaurantsRestaurantIdCreditStatementsStatementIdGetRaw(
                { restaurantId, statementId }
            );
        const data = unwrapData<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        if (!data) {
            return null;
        }
        return withId<CreditStatement>(
            [data as CreditStatement],
            'statementId'
        )[0];
    }

    /** Fetches a statement PDF as a Blob for download. */
    async downloadStatementPdf(statementId: string): Promise<Blob> {
        const restaurantId = await this._restaurantId();
        const res =
            await restaurantCreditApi.apiV1RestaurantsRestaurantIdCreditStatementsStatementIdPdfGetRaw(
                { restaurantId, statementId }
            );
        return res.raw.blob();
    }

    private _restaurantId(): Promise<string> {
        return this._profileService.restaurantId();
    }
}
