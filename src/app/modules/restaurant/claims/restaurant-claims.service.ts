import { Injectable } from '@angular/core';
import {
    extractList,
    extractNextCursor,
    parseJson,
    unwrapData,
    withId,
} from 'app/core/api/envelope';
import { CLAIM_PAGE_SIZE, ClaimRow } from 'app/modules/orders/claims.types';
import { claimsApi } from 'contract';

/** One cursor page of the restaurant's own claims. */
export interface RestaurantClaimsPage {
    claims: ClaimRow[];
    /** Absent on the last page — the list endpoint stops sending one. */
    nextCursor?: string;
}

/**
 * The filing half of `/api/v1/claims`, for the signed-in restaurant.
 *
 * Listing is not scoped by a parameter here on purpose: `ListClaimsQuery`
 * resolves the caller's own restaurant when they are not privileged, so a
 * `restaurantId` from the client would be ignored at best and wrong at worst.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantClaimsService {
    /** Claims this restaurant has filed, newest first. */
    async listMyClaims(cursor?: string | null): Promise<RestaurantClaimsPage> {
        const res = await claimsApi.apiV1ClaimsGetRaw({
            cursor: cursor || undefined,
            pageSize: CLAIM_PAGE_SIZE,
        });
        const body = await parseJson(res.raw);
        return {
            claims: withId<ClaimRow>(
                extractList(body),
                'claimId'
            ) as ClaimRow[],
            nextCursor: extractNextCursor(body),
        };
    }

    /**
     * Files a claim against one order.
     *
     * Beyond the field rules mirrored in the form, the handler can still refuse
     * this: the order must be at the hub or delivered
     * (`CLAIM_ORDER_NOT_CLAIMABLE`, 409) and the amount may not exceed what the
     * order was charged (`INVALID_CLAIM_AMOUNT`, 422). Both are mapped, so the
     * caller only has to hand the error to `describeApiError`.
     */
    async fileClaim(
        orderId: string,
        amount: number,
        reason: string
    ): Promise<ClaimRow> {
        const res = await claimsApi.apiV1OrdersOrderIdClaimsPostRaw({
            orderId,
            fileClaimRequest: { amount, reason },
        });
        const body = await parseJson(res.raw);
        return (unwrapData(body) ?? {}) as ClaimRow;
    }
}
