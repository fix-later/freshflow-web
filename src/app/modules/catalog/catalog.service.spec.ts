import { TestBed } from '@angular/core/testing';
import { MAX_PAGE_SIZE } from 'app/core/api/envelope';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { marketsApi, productsApi } from 'contract';
import { CatalogService } from './catalog.service';

/** A market-listing row shaped like the backend's (untyped) response. */
const row = (productId: string, name: string, isFeatured = false) => ({
    productId,
    productName: name,
    price: 10000,
    availableQuantity: 5,
    isFeatured,
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
 * The catalog reads a market's listing in full, once, so that search, price,
 * sort and the result count can all run over the complete set (the endpoint
 * supports none of them and reports no total). The risk lives in the crawl —
 * when to stop, what a mid-crawl failure leaves behind, and what happens when
 * the market changes while it is still running — so that is what these cover.
 */
describe('CatalogService market listing', () => {
    let service: CatalogService;
    let markets: MarketSelectionService;

    const fullPage = (cursor?: string, offset = 0) =>
        envelope(
            Array.from({ length: MAX_PAGE_SIZE }, (_, i) =>
                row(`p${offset + i}`, `Sản phẩm ${offset + i}`)
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

    it('reads the listing at the largest page the API accepts', async () => {
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.resolveTo(envelope([row('p1', 'Cải ngọt')]) as never);

        await service.loadMarketListing('m1');

        expect(get).toHaveBeenCalledTimes(1);
        const args = get.calls.mostRecent().args[0];
        expect(args.marketId).toBe('m1');
        expect(args.pageSize).toBe(MAX_PAGE_SIZE);
        expect(args.cursor).toBeUndefined();
        expect(service.products().length).toBe(1);
        expect(service.products()[0].name).toBe('Cải ngọt');
        expect(service.products()[0].marketSource).toBe('Chợ A');
        expect(service.listingComplete()).toBe(true);
    });

    it('sends no category filter — filtering is client-side over the whole listing', async () => {
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.resolveTo(envelope([row('p1', 'Cải ngọt')]) as never);

        await service.loadMarketListing('m1');

        expect(get.calls.mostRecent().args[0].category).toBeUndefined();
    });

    it('follows the cursor to the end of the listing', async () => {
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.returnValues(
            Promise.resolve(fullPage('cursor-2')) as never,
            Promise.resolve(envelope([row('last', 'Cuối')])) as never
        );

        await service.loadMarketListing('m1');

        expect(get).toHaveBeenCalledTimes(2);
        expect(get.calls.mostRecent().args[0].cursor).toBe('cursor-2');
        expect(service.products().length).toBe(MAX_PAGE_SIZE + 1);
        expect(service.listingComplete()).toBe(true);
    });

    it('stops at a short page even when the server still returns a cursor', async () => {
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.resolveTo(envelope([row('p1', 'Một')], 'cursor-2') as never);

        await service.loadMarketListing('m1');

        expect(get).toHaveBeenCalledTimes(1);
    });

    it('stops rather than looping when the cursor does not advance', async () => {
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.callFake(() => Promise.resolve(fullPage('same')) as never);

        await service.loadMarketListing('m1');

        expect(get).toHaveBeenCalledTimes(2);
    });

    it('de-duplicates rows repeated across pages, so the total stays honest', async () => {
        spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.returnValues(
            Promise.resolve(fullPage('cursor-2')) as never,
            // Page 2 repeats p0 (already on page 1) plus one genuinely new row.
            Promise.resolve(
                envelope([row('p0', 'Sản phẩm 0'), row('new', 'Mới')])
            ) as never
        );

        await service.loadMarketListing('m1');

        expect(service.products().length).toBe(MAX_PAGE_SIZE + 1);
    });

    it('keeps the pages it read when the crawl fails partway, but not the total', async () => {
        // `callFake`, not `returnValues`: a rejected promise built up front is
        // unhandled until the crawl reaches it, which Karma reports as an error.
        let call = 0;
        spyOn(marketsApi, 'apiV1MarketsMarketIdProductsGetRaw').and.callFake(
            () =>
                (call++ === 0
                    ? Promise.resolve(fullPage('cursor-2'))
                    : Promise.reject(new Error('network'))) as never
        );

        await service.loadMarketListing('m1');

        expect(service.products().length).toBe(MAX_PAGE_SIZE);
        // The rows are a prefix, so no count taken from them is a total.
        expect(service.listingComplete()).toBe(false);
    });

    it('retries after a partial crawl instead of caching it as the listing', async () => {
        let call = 0;
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.callFake(() => {
            const step = call++;
            if (step === 0) {
                return Promise.resolve(fullPage('cursor-2')) as never;
            }
            return (
                step === 1
                    ? Promise.reject(new Error('network'))
                    : Promise.resolve(envelope([row('p1', 'Cải ngọt')]))
            ) as never;
        });

        await service.loadMarketListing('m1');
        await service.loadMarketListing('m1');

        expect(get).toHaveBeenCalledTimes(3);
        expect(service.listingComplete()).toBe(true);
        expect(service.products().length).toBe(1);
    });

    it('does not request anything until a market is chosen', async () => {
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.resolveTo(envelope([]) as never);

        await service.loadMarketListing(null);

        expect(get).not.toHaveBeenCalled();
        expect(service.products()).toEqual([]);
        expect(service.listingComplete()).toBe(true);
    });

    it('crawls a market once and replays the cached listing', async () => {
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.resolveTo(envelope([row('p1', 'Cải ngọt')]) as never);

        await service.loadMarketListing('m1');
        await service.loadMarketListing('m1');

        expect(get).toHaveBeenCalledTimes(1);
        expect(service.products().length).toBe(1);
    });

    it('discards a listing that arrives after the market changed', async () => {
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

        const first = service.loadMarketListing('m1');
        // The user switches market before the first response lands.
        await service.loadMarketListing('m2');
        releaseFirst(null);
        await first;

        const names = service.products().map((product) => product.name);
        expect(names).toEqual(['Hàng chợ mới']);
    });
});

/**
 * The header's Hot Deals menu harvests featured listings from page 1, which
 * the backend pins ahead of the ordinary rows. What matters here is that the
 * ordinary rows riding along are discarded, that the result is cached per
 * market, and that an empty answer is *not* cached — a guest 401 is swallowed
 * into `[]` and would otherwise leave the menu permanently empty.
 */
describe('CatalogService featured listings', () => {
    let service: CatalogService;

    beforeEach(() => {
        TestBed.resetTestingModule();
        localStorage.removeItem('freshflow.selectedMarket');
        service = TestBed.inject(CatalogService);
        TestBed.inject(MarketSelectionService).select({
            id: 'm1',
            name: 'Chợ A',
        });
        spyOn(productsApi, 'apiV1ProductsGetRaw').and.resolveTo(
            envelope([]) as never
        );
    });

    afterEach(() => localStorage.removeItem('freshflow.selectedMarket'));

    it('keeps only the pinned rows from page 1', async () => {
        spyOn(marketsApi, 'apiV1MarketsMarketIdProductsGetRaw').and.resolveTo(
            envelope([
                row('p1', 'Cải ngọt', true),
                row('p2', 'Cà rốt'),
                row('p3', 'Ớt hiểm', true),
            ]) as never
        );

        const featured = await service.getFeaturedProducts('m1');

        expect(featured.map((product) => product.name)).toEqual([
            'Cải ngọt',
            'Ớt hiểm',
        ]);
        expect(featured.every((product) => product.featured)).toBe(true);
    });

    it('leaves the paged catalog listing untouched', async () => {
        spyOn(marketsApi, 'apiV1MarketsMarketIdProductsGetRaw').and.resolveTo(
            envelope([row('p1', 'Cải ngọt', true)]) as never
        );

        await service.getFeaturedProducts('m1');

        expect(service.products()).toEqual([]);
    });

    it('fetches once per market and replays the cached result', async () => {
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.resolveTo(envelope([row('p1', 'Cải ngọt', true)]) as never);

        await service.getFeaturedProducts('m1');
        await service.getFeaturedProducts('m1');

        expect(get).toHaveBeenCalledTimes(1);
    });

    it('retries after an empty result instead of caching it', async () => {
        const get = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.returnValues(
            Promise.resolve(envelope([row('p1', 'Cà rốt')])) as never,
            Promise.resolve(envelope([row('p1', 'Cà rốt', true)])) as never
        );

        expect(await service.getFeaturedProducts('m1')).toEqual([]);
        expect((await service.getFeaturedProducts('m1')).length).toBe(1);
        expect(get).toHaveBeenCalledTimes(2);
    });
});

/**
 * Listing tags have changed shape twice — `is_featured` boolean, then a
 * free-form `tags: string[]` (SCRUM-385), then `tags: [{id,name,pinsToTop}]`
 * referencing the tag catalog (SCRUM-386). A deployment can be serving any of
 * them, and reading the wrong one fails **silently**: the board simply stops
 * pinning anything and the tag facet empties, with no error to notice. All
 * three paths are pinned down here.
 */
describe('CatalogService listing tags', () => {
    let service: CatalogService;

    /** A catalog tag as `MarketProductTagDto` serialises it. */
    const tag = (id: string, name: string, pinsToTop = false) => ({
        id,
        name,
        pinsToTop,
    });

    /** A listing row carrying `tags`. */
    const tagged = (productId: string, name: string, tags: unknown[]) => ({
        productId,
        productName: name,
        price: 10000,
        availableQuantity: 5,
        tags,
    });

    beforeEach(() => {
        TestBed.resetTestingModule();
        localStorage.removeItem('freshflow.selectedMarket');
        service = TestBed.inject(CatalogService);
        TestBed.inject(MarketSelectionService).select({
            id: 'm1',
            name: 'Chợ A',
        });
        spyOn(productsApi, 'apiV1ProductsGetRaw').and.resolveTo(
            envelope([]) as never
        );
    });

    afterEach(() => localStorage.removeItem('freshflow.selectedMarket'));

    it('reads catalog tag objects and derives featured from pinsToTop', async () => {
        spyOn(marketsApi, 'apiV1MarketsMarketIdProductsGetRaw').and.resolveTo(
            envelope([
                tagged('p1', 'Cải ngọt', [
                    tag('t1', 'nổi bật', true),
                    tag('t2', 'hàng đà lạt'),
                ]),
                tagged('p2', 'Cà rốt', [tag('t3', 'size lớn')]),
            ]) as never
        );

        await service.loadMarketListing('m1');

        const [first, second] = service.products();
        expect(first.tags.map((t) => t.name)).toEqual([
            'nổi bật',
            'hàng đà lạt',
        ]);
        // The name is incidental — only the flag decides pinning now.
        expect(first.featured).toBe(true);
        expect(second.tags.map((t) => t.name)).toEqual(['size lớn']);
        expect(second.featured).toBe(false);
    });

    it('pins on the flag, not on the tag being named "nổi bật"', async () => {
        spyOn(marketsApi, 'apiV1MarketsMarketIdProductsGetRaw').and.resolveTo(
            envelope([
                // Named like the old magic tag but not a pinning tag…
                tagged('p1', 'Cải ngọt', [tag('t1', 'nổi bật', false)]),
                // …and pinning under a completely different name.
                tagged('p2', 'Cà rốt', [tag('t2', 'giá sốc', true)]),
            ]) as never
        );

        await service.loadMarketListing('m1');

        const [first, second] = service.products();
        expect(first.featured).toBe(false);
        expect(second.featured).toBe(true);
    });

    it('keeps a bare string tag readable but never lets it claim to pin', async () => {
        spyOn(marketsApi, 'apiV1MarketsMarketIdProductsGetRaw').and.resolveTo(
            // The SCRUM-385 shape: names only, no catalog behind them.
            envelope([tagged('p1', 'Cải ngọt', ['  Nổi Bật ', 42])]) as never
        );

        await service.loadMarketListing('m1');

        const product = service.products()[0];
        expect(product.tags.map((t) => t.name)).toEqual(['nổi bật']);
        // Only the catalog knows what pins, and a bare string has no catalog.
        expect(product.featured).toBe(false);
    });

    it('de-duplicates by id, then by name', async () => {
        spyOn(marketsApi, 'apiV1MarketsMarketIdProductsGetRaw').and.resolveTo(
            envelope([
                tagged('p1', 'Cải ngọt', [
                    tag('t1', 'size lớn'),
                    tag('t1', 'size lớn'),
                    'SIZE LỚN',
                ]),
            ]) as never
        );

        await service.loadMarketListing('m1');

        expect(service.products()[0].tags.map((t) => t.name)).toEqual([
            'size lớn',
        ]);
    });

    it('still pins from isFeatured when the server predates tags', async () => {
        spyOn(marketsApi, 'apiV1MarketsMarketIdProductsGetRaw').and.resolveTo(
            envelope([
                {
                    productId: 'p1',
                    productName: 'Cải ngọt',
                    price: 10000,
                    isFeatured: true,
                },
            ]) as never
        );

        await service.loadMarketListing('m1');

        expect(service.products()[0].featured).toBe(true);
    });

    it('leaves a row with neither field untagged rather than guessing', async () => {
        spyOn(marketsApi, 'apiV1MarketsMarketIdProductsGetRaw').and.resolveTo(
            envelope([
                { productId: 'p1', productName: 'Cải ngọt', price: 10000 },
            ]) as never
        );

        await service.loadMarketListing('m1');

        expect(service.products()[0].tags).toEqual([]);
        expect(service.products()[0].featured).toBe(false);
    });
});

/**
 * `categoryCounts` exists so the storefront landing can show real per-aisle
 * numbers without paying for them. The whole point is that it costs no request,
 * so that is the property under test alongside the grouping itself.
 */
describe('CatalogService category counts', () => {
    let service: CatalogService;

    beforeEach(() => {
        TestBed.resetTestingModule();
        localStorage.removeItem('freshflow.selectedMarket');
        service = TestBed.inject(CatalogService);
    });

    afterEach(() => localStorage.removeItem('freshflow.selectedMarket'));

    it('groups by categoryId and skips uncategorised products', async () => {
        spyOn(productsApi, 'apiV1ProductsGetRaw').and.resolveTo(
            envelope([
                { id: 'p1', categoryId: 'c1' },
                { id: 'p2', categoryId: 'c1' },
                { id: 'p3', categoryId: 'c2' },
                // No category: must not land under a blank key.
                { id: 'p4' },
            ]) as never
        );

        const counts = await service.categoryCounts();

        expect(counts.get('c1')).toBe(2);
        expect(counts.get('c2')).toBe(1);
        expect(counts.has('')).toBe(false);
    });

    it('never touches the market listing endpoint', async () => {
        spyOn(productsApi, 'apiV1ProductsGetRaw').and.resolveTo(
            envelope([{ id: 'p1', categoryId: 'c1' }]) as never
        );
        const listing = spyOn(
            marketsApi,
            'apiV1MarketsMarketIdProductsGetRaw'
        ).and.resolveTo(envelope([]) as never);

        await service.categoryCounts();

        expect(listing).not.toHaveBeenCalled();
    });

    it('reuses the cached base products across calls', async () => {
        const base = spyOn(productsApi, 'apiV1ProductsGetRaw').and.resolveTo(
            envelope([{ id: 'p1', categoryId: 'c1' }]) as never
        );

        await service.categoryCounts();
        await service.categoryCounts();

        expect(base).toHaveBeenCalledTimes(1);
    });
});
