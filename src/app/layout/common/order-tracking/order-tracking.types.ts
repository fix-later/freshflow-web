/** Coarse status for the header's "latest order" hover preview (PRD M5 · FR-ORD). */
export type RecentOrderStatus = 'CONFIRMED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

export interface RecentOrder {
    code: string;
    /** ISO timestamp. */
    placedAt: string;
    itemCount: number;
    status: RecentOrderStatus;
}
