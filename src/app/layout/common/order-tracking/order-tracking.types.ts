/** The restaurant's most recent order, for the header's hover preview. */
export interface RecentOrder {
    /** Short display code — the order id's first segment. */
    code: string;
    /** ISO timestamp. */
    placedAt: string;
    itemCount: number;
    /** Raw backend status — normalize with `orders.types.ts`'s helpers to render. */
    status: string;
}
