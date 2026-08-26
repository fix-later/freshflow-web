import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { CatalogService } from 'app/modules/catalog/catalog.service';
import { clearTokens, setTokens } from 'contract';

import { FakeHub, fakeHubFactory } from './fake-hub';
import { PricingRealtimeService } from './pricing-realtime.service';
import { HUB_CONNECTION_FACTORY } from './realtime-connection';

const PRICE_EVENT = {
    marketProductId: 'mp-1',
    marketId: 'market-1',
    productId: 'p-1',
    oldPrice: 100_000,
    newPrice: 120_000,
    currentQuantity: 40,
    updatedBy: 'u-1',
    occurredAt: '2026-08-24T01:00:00Z',
};

/** Lets the service's chain of awaited hub calls settle before asserting. */
function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Applied price updates, and the listing reloads the service asked for. */
interface CatalogSpy {
    applied: { marketProductId: string; newPrice: number }[];
    reloaded: (string | null)[];
}

function setup(): {
    service: PricingRealtimeService;
    hub: FakeHub;
    catalog: CatalogSpy;
    selectedId: ReturnType<typeof signal<string | null>>;
} {
    // Seeded rather than created on demand so a test can arrange the hub
    // (a refused join, say) before the service ever connects.
    const hubs = new Map<string, FakeHub>([['pricing', new FakeHub()]]);
    const catalog: CatalogSpy = { applied: [], reloaded: [] };
    const selectedId = signal<string | null>('market-1');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [
            { provide: HUB_CONNECTION_FACTORY, useValue: fakeHubFactory(hubs) },
            {
                provide: CatalogService,
                useValue: {
                    applyPriceUpdate: (update: {
                        marketProductId: string;
                        newPrice: number;
                    }) => catalog.applied.push(update),
                    loadMarketListing: async (marketId: string | null) => {
                        catalog.reloaded.push(marketId);
                    },
                },
            },
            { provide: MarketSelectionService, useValue: { selectedId } },
        ],
    });

    setTokens('header.eyJzdWIiOiJ1LTEifQ.signature', 'refresh-1');
    const service = TestBed.inject(PricingRealtimeService);
    return {
        service,
        get hub(): FakeHub {
            return hubs.get('pricing')!;
        },
        catalog,
        selectedId,
    };
}

/**
 * `PricingHub` is the one hub whose group is **not** derived from the JWT: a
 * connection hears nothing until it calls `JoinMarketAsync`, and the client
 * restores its connection on a reconnect but never its groups. Both of those
 * fail silently — a healthy socket that delivers nothing — so they are pinned
 * here.
 */
describe('PricingRealtimeService', () => {
    afterEach(() => {
        clearTokens();
    });

    it('joins the selected market when it connects', async () => {
        const ctx = setup();

        await ctx.service.connect();

        expect(ctx.hub.calls).toEqual(['JoinMarketAsync']);
        expect(ctx.hub.lastArgs('JoinMarketAsync')).toEqual(['market-1']);
    });

    it('leaves the old market and joins the new one when the picker changes', async () => {
        const ctx = setup();
        await ctx.service.connect();

        ctx.selectedId.set('market-2');
        // The service follows the picker through an effect, so the change has
        // to be flushed the way the running app would flush it.
        TestBed.inject(ApplicationRef).tick();
        await flush();

        expect(ctx.hub.calls).toEqual([
            'JoinMarketAsync',
            'LeaveMarketAsync',
            'JoinMarketAsync',
        ]);
        expect(ctx.hub.lastArgs('LeaveMarketAsync')).toEqual(['market-1']);
        expect(ctx.hub.lastArgs('JoinMarketAsync')).toEqual(['market-2']);
    });

    it('applies a price update to the listing', async () => {
        const ctx = setup();
        await ctx.service.connect();

        ctx.hub.emit('PriceUpdated', PRICE_EVENT);

        expect(ctx.catalog.applied.length).toBe(1);
        expect(ctx.catalog.applied[0].marketProductId).toBe('mp-1');
        expect(ctx.catalog.applied[0].newPrice).toBe(120_000);
    });

    it('ignores an update for a market this connection is not shopping', async () => {
        const ctx = setup();
        await ctx.service.connect();

        // A join that lags a market switch would otherwise repaint the new
        // listing with the previous market's prices.
        ctx.hub.emit('PriceUpdated', { ...PRICE_EVENT, marketId: 'market-9' });

        expect(ctx.catalog.applied).toEqual([]);
    });

    it('ignores a payload that is not a price update', async () => {
        const ctx = setup();
        await ctx.service.connect();

        ctx.hub.emit('PriceUpdated', { marketProductId: 'mp-1' });
        ctx.hub.emit('PriceUpdated', { ...PRICE_EVENT, newPrice: 'cheap' });

        expect(ctx.catalog.applied).toEqual([]);
    });

    it('re-joins the market group after a reconnect, then re-reads the listing', async () => {
        const ctx = setup();
        await ctx.service.connect();
        ctx.hub.invocations.length = 0;

        ctx.hub.reconnect();
        await flush();

        // Without the re-join the socket is up and permanently silent.
        expect(ctx.hub.calls).toEqual(['JoinMarketAsync']);
        // And whatever moved while it was down never arrives as an event.
        expect(ctx.catalog.reloaded).toEqual(['market-1']);
    });

    it('does not consider itself joined when the hub refuses the join', async () => {
        const ctx = setup();
        ctx.hub.failInvoke = true;

        await ctx.service.connect();

        // An agent with no assignment to this market is refused. Believing the
        // join succeeded would make the filter drop events from a later,
        // legitimate join.
        ctx.hub.failInvoke = false;
        ctx.hub.emit('PriceUpdated', PRICE_EVENT);
        expect(ctx.catalog.applied.length).toBe(1);
    });
});
