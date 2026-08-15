/** A notification row (`GET /notifications`), parsed defensively — untyped in the spec. */
export interface NotificationView {
    id: string;
    type: string;
    title: string;
    description: string;
    link: string | null;
    /** ISO timestamp. */
    createdAt: string;
    isRead: boolean;
    /** Service date carried by a market-session notice (`yyyy-MM-dd`). */
    serviceDate: string | null;
    marketName: string | null;
}
