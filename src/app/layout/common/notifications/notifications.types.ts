/** A notification row (`GET /notifications`), parsed defensively — untyped in the spec. */
export interface NotificationView {
    id: string;
    title: string;
    description: string;
    link: string | null;
    /** ISO timestamp. */
    createdAt: string;
    isRead: boolean;
}
