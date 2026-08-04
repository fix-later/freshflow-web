import { TestBed } from '@angular/core/testing';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { marketsApi, productsApi } from 'contract';
import { CATALOG_PAGE_SIZE, CatalogService } from './catalog.service';

/** A market-listing row shaped like the backend's (untyped) response. */
const row = (productId: string, name: string) => ({
    productId,
    productName: name,
    price: 10000,
    availableQuantity: 5,
});

/** Wraps a body in the `{ success, data }` envelope the API returns. */
const envelope = (items: unknown[], nextCursor?: string) =>
    ({
        raw: new Response(
            JSON.stringify({
                success: true,
                data: { items },
                meta: nextCursor ? { nextCursor } : {},
            })
        ),
    }) as never;

/**
 * The catalog pages one market's listing with a cursor. The risk lives in the
 * paging bookkeeping — when to stop, and what happens when the market changes
 * while a page is still in flight — so that is what these cover.
 */
describe('CatalogService paging', () => {
    let service: CatalogService;
    let markets: MarketSelectionService;

    const fullPage = (cursor?: string) =>
        envelope(
            Array.from({ length: CATALOG_PAGE_SIZE }, (_, i) =>
                row(`p${i}`, `Sản phẩm ${i}`)
            ),
            cursor
        );

    beforeEach(() => {
        TestBed.resetTestingModule();
        localStorage.removeItem('freshflow.selectedMarket');
        service = TestBed.inject(CatalogService);
        markets = TestBed.inject(MarketSelectionService);
        markets.select({ id: 'm1', name: 'Chợ A' });

        // The base-product join is not under test; keep it empty and cheap.
        spyOn(productsApi, 'apiV1ProductsGetRaw').and.resolveTo(
            envelope([]) as never
        );
    });

    afterEach(() => localStorage.removeItem('freshflow.selectedMarket'));

    it('asks for one page of CATALOG_PAGE_SIZE rows, without a cursor', async () => {
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.resolveTo(envelope([row('p1', 'Cải ngọt')]) as never);

        await service.loadFirstPage('m1');

        expect(get).toHaveBeenCalledTimes(1);
        const args = get.calls.mostRecent().args[0];
        expect(args.marketId).toBe('m1');
        expect(args.pageSize).toBe(CATALOG_PAGE_SIZE);
        expect(args.cursor).toBeUndefined();
        expect(service.products().length).toBe(1);
        expect(service.products()[0].name).toBe('Cải ngọt');
        expect(service.products()[0].marketSource).toBe('Chợ A');
    });

    it('forwards the category filter to the market listing request', async () => {
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.resolveTo(envelope([row('p1', 'Cải ngọt')]) as never);

        await service.loadFirstPage('m1', 'cat-leaf');

        expect(get.calls.mostRecent().args[0].category).toBe('cat-leaf');
    });

    it('appends the next page and forwards the cursor', async () => {
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.returnValues(
            Promise.resolve(fullPage('cursor-2')) as never,
            Promise.resolve(envelope([row('last', 'Cuối')])) as never
        );

        await service.loadFirstPage('m1');
        expect(service.hasMore()).toBe(true);

        await service.loadNextPage();

        expect(get.calls.mostRecent().args[0].cursor).toBe('cursor-2');
        expect(service.products().length).toBe(CATALOG_PAGE_SIZE + 1);
        expect(service.hasMore()).toBe(false);
    });

    it('stops at a short page even when the server still returns a cursor', async () => {
        spyOn(marketsApi, 'apiV1MarketsMarketIdProductsGetRaw').and.resolveTo(
            envelope([row('p1', 'Một')], 'cursor-2') as never
        );

        await service.loadFirstPage('m1');

        expect(service.hasMore()).toBe(false);
    });

    it('does not request anything until a market is chosen', async () => {
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.resolveTo(envelope([]) as never);

        await service.loadFirstPage(null);

        expect(get).not.toHaveBeenCalled();
        expect(service.products()).toEqual([]);
        expect(service.hasMore()).toBe(false);
    });

    it('discards a page that arrives after the market changed', async () => {
        let releaseFirst: (value: unknown) => void = () => undefined;
        const slowFirst = new Promise((resolve) => (releaseFirst = resolve));

        spyOn(marketsApi, 'apiV1MarketsMarketIdProductsGetRaw').and.callFake(
            (params: { marketId: string }) =>
                params.marketId === 'm1'
                    ? (slowFirst.then(() =>
                          envelope([row('stale', 'Hàng chợ cũ')])
                      ) as never)
                    : (Promise.resolve(
                          envelope([row('fresh', 'Hàng chợ mới')])
                      ) as never)
        );

        const first = service.loadFirstPage('m1');
        // The user switches market before the first response lands.
        await service.loadFirstPage('m2');
        releaseFirst(null);
        await first;

        const names = service.products().map((product) => product.name);
        expect(names).toEqual(['Hàng chợ mới']);
    });
});
