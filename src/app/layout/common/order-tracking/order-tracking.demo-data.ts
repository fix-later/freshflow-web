import { RecentOrder } from './order-tracking.types';

/**
 * Bundled demo "latest order" for the header hover preview — replace once
 * the real M5 Order Management API (list/detail, real-time status per
 * BR-ORD-6) lands.
 */
export const DEMO_LATEST_ORDER: RecentOrder = {
    code: 'DH260713-04',
    placedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 90 minutes ago
    itemCount: 12,
    status: 'OUT_FOR_DELIVERY',
};
