import { Injectable, signal } from '@angular/core';
import { DEMO_LATEST_ORDER } from './order-tracking.demo-data';
import { RecentOrder } from './order-tracking.types';

/**
 * The restaurant's most recently placed order, read-only, for the header's
 * hover preview. Order status is real-time and never polled (BR-ORD-6) —
 * seeded with demo data here until the real Order Management store exists.
 */
@Injectable({ providedIn: 'root' })
export class OrderTrackingService {
    private readonly _latestOrder = signal<RecentOrder | null>(
        DEMO_LATEST_ORDER
    );

    readonly latestOrder = this._latestOrder.asReadonly();
}
