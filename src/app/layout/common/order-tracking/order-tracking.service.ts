import { Injectable, inject, signal } from '@angular/core';
import { OrdersService } from 'app/modules/orders/orders.service';
import { RecentOrder } from './order-tracking.types';

/**
 * The restaurant's most recently placed order, read-only, for the header's
 * hover preview. Order status is real-time and never polled (BR-ORD-6) —
 * loaded once per session from `GET /orders` via `OrdersService`.
 */
@Injectable({ providedIn: 'root' })
export class OrderTrackingService {
    private readonly _ordersService = inject(OrdersService);
    private readonly _latestOrder = signal<RecentOrder | null>(null);
    private _loaded = false;
    private _loading: Promise<void> | null = null;

    readonly latestOrder = this._latestOrder.asReadonly();

    /** Loads the latest order once; safe to call from multiple entry points. */
    async ensureLoaded(): Promise<void> {
        if (this._loaded) {
            return;
        }
        if (!this._loading) {
            this._loading = this._load();
        }
        return this._loading;
    }

    private async _load(): Promise<void> {
        try {
            const order = await this._ordersService.getLatestOrder();
            this._latestOrder.set(
                order
                    ? {
                          code: (order.id ?? '').slice(0, 8),
                          placedAt: order.createdAt ?? '',
                          itemCount: order.items?.length ?? 0,
                          status: order.status ?? '',
                      }
                    : null
            );
        } catch {
            this._latestOrder.set(null);
        } finally {
            this._loaded = true;
        }
    }
}
