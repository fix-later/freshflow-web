import { Injectable, NgZone, type Signal, effect, inject } from '@angular/core';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { CatalogService } from 'app/modules/catalog/catalog.service';
import {
    HUB_CONNECTION_FACTORY,
    RealtimeConnection,
} from './realtime-connection';

/** Server → client method name on `PricingHub`. */
const PRICE_UPDATED = 'PriceUpdated';

/** Hub methods that put this connection in / out of a market's group. */
const JOIN_MARKET = 'JoinMarketAsync';
const LEAVE_MARKET = 'LeaveMarketAsync';

/** `PriceUpdateBroadcastDto`, camelCased by SignalR's JSON protocol. */
export interface PriceUpdatedEvent {
    marketProductId: string;
    marketId: string;
    productId: string;
    oldPrice: number;
    newPrice: number;
    /** Stock **on hand**, before other buyers' open orders reserve their share. */
    currentQuantity: number;
    updatedBy: string | null;
    occurredAt: string;
}

/** Narrows the `unknown` the hub delivers; see the notification guard. */
export function isPriceUpdatedEvent(
    value: unknown
): value is PriceUpdatedEvent {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const event = value as Partial<PriceUpdatedEvent>;
    return (
        typeof event.marketProductId === 'string' &&
        typeof event.marketId === 'string' &&
        typeof event.newPrice === 'number' &&
        Number.isFinite(event.newPrice) &&
        typeof event.currentQuantity === 'number' &&
        Number.isFinite(event.currentQuantity)
    );
}

/**
 * Live prices for the market being shopped (`/hubs/pricing`).
 *
 * Unlike every other hub here, `PricingHub` does **not** derive its group from
 * the JWT: a client is silent until it calls `JoinMarketAsync(marketId)`. Two
 * consequences shape this service.
 *
 * 1. The group follows {@link MarketSelectionService}. Switching market leaves
 *    the old group and joins the new one, so a buyer never sees another
 *    market's prices land in their listing.
 * 2. **A reconnect does not restore the group.** The client rejoins its
 *    connection, not its groups, so without an explicit re-join the socket
 *    comes back healthy and permanently silent — the failure mode that is
 *    hardest to notice, because nothing errors. {@link RealtimeConnection}'s
 *    reconnect hook re-joins and then re-reads the listing, since anything
 *    broadcast during the gap is gone.
 *
 * The hub also authorises the join: a market agent may only subscribe to a
 * market they are assigned to (admins bypass). A refused join throws inside the
 * hub, which surfaces here as `invoke()` answering false — the page keeps
 * working, it just is not live.
 */
@Injectable({ providedIn: 'root' })
export class PricingRealtimeService {
    private readonly _catalog = inject(CatalogService);
    private readonly _markets = inject(MarketSelectionService);
    private readonly _connection = new RealtimeConnection(
        'pricing',
        inject(NgZone),
        inject(HUB_CONNECTION_FACTORY)
    );

    /** Market group this connection is currently in, or `null`. */
    private _joined: string | null = null;

    readonly connected: Signal<boolean> = this._connection.connected;

    constructor() {
        this._connection.on(PRICE_UPDATED, isPriceUpdatedEvent, (event) => {
            // Belt and braces: the group already scopes this to one market, but
            // a join that is a beat behind a market switch would otherwise
            // repaint the new listing with the old market's prices.
            if (this._joined && event.marketId !== this._joined) {
                return;
            }
            this._catalog.applyPriceUpdate(event);
        });

        this._connection.onReconnected(async () => {
            const marketId = this._joined;
            this._joined = null;
            if (marketId) {
                await this._join(marketId);
                // The gap is unknowable, so the listing is re-read rather than
                // trusted: prices that moved while the socket was down never
                // arrive as events.
                await this._catalog.loadMarketListing(marketId);
            }
        });

        // Follows the picker for as long as the app is running. The effect is
        // in an injection context (field initialiser of a root service), so it
        // lives as long as the service does.
        effect(() => {
            const marketId = this._markets.selectedId();
            void this._syncGroup(marketId);
        });
    }

    /** Opens the feed for one subscriber (a mounted catalog surface). */
    async connect(): Promise<void> {
        await this._connection.connect();
        await this._syncGroup(this._markets.selectedId());
    }

    /** Re-attempts after a sign-in, without claiming a subscriber. */
    async resync(): Promise<void> {
        await this._connection.resync();
        await this._syncGroup(this._markets.selectedId());
    }

    /** Releases one subscriber; the socket closes with the last one. */
    async disconnect(): Promise<void> {
        await this._connection.disconnect();
        if (!this._connection.connected()) {
            this._joined = null;
        }
    }

    /** Moves the connection from whatever group it is in to `marketId`'s. */
    private async _syncGroup(marketId: string | null): Promise<void> {
        if (this._joined === marketId) {
            return;
        }
        if (this._joined) {
            await this._connection.invoke(LEAVE_MARKET, this._joined);
            this._joined = null;
        }
        if (marketId) {
            await this._join(marketId);
        }
    }

    private async _join(marketId: string): Promise<void> {
        // Only remember the group when the hub accepted it — a refused join
        // (unassigned agent) must not look joined, or the payload filter above
        // would start dropping events this connection legitimately receives
        // after a later, successful join.
        if (await this._connection.invoke(JOIN_MARKET, marketId)) {
            this._joined = marketId;
        }
    }
}
