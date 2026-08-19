import { marketsApi } from 'contract';
import { MarketSelectionService } from './market-selection.service';

/** Wraps market rows in the `{ success, data }` envelope the API returns. */
const envelope = (rows: unknown[]) =>
    ({
        raw: new Response(
            JSON.stringify({ success: true, data: { items: rows } })
        ),
    }) as never;

const row = (id: string, name: string) => ({ id, name });

/**
 * The market list is the same on every storefront page, so it is cached in
 * `localStorage`: without that, `GET /markets` went out on each page load. What
 * matters is that the cache is actually reused, that it does not outlive its
 * TTL, and that a retry can still get past it.
 */
describe('MarketSelectionService market list cache', () => {
    const LIST_KEY = 'freshflow.markets';
    const SELECTED_KEY = 'freshflow.selectedMarket';

    beforeEach(() => {
        localStorage.removeItem(LIST_KEY);
        localStorage.removeItem(SELECTED_KEY);
    });

    afterEach(() => {
        localStorage.removeItem(LIST_KEY);
        localStorage.removeItem(SELECTED_KEY);
    });

    it('serves a later page load from the cache instead of refetching', async () => {
        const get = spyOn(marketsApi, 'apiV1MarketsGetRaw').and.resolveTo(
            envelope([row('m1', 'Chợ A')])
        );

        await new MarketSelectionService().ensureLoaded();
        expect(get).toHaveBeenCalledTimes(1);

        // A new instance stands in for the next page load rebuilding the app.
        const next = new MarketSelectionService();
        await next.ensureLoaded();

        expect(get).toHaveBeenCalledTimes(1);
        expect(next.markets().length).toBe(1);
        expect(next.markets()[0].name).toBe('Chợ A');
    });

    it('refetches once the cached list is older than its TTL', async () => {
        const stale = Date.now() - 2 * 60 * 60 * 1000;
        localStorage.setItem(
            LIST_KEY,
            JSON.stringify({ v: 1, at: stale, markets: [row('m1', 'Chợ A')] })
        );
        const get = spyOn(marketsApi, 'apiV1MarketsGetRaw').and.resolveTo(
            envelope([row('m2', 'Chợ B')])
        );

        const service = new MarketSelectionService();
        await service.ensureLoaded();

        expect(get).toHaveBeenCalledTimes(1);
        expect(service.markets()[0].id).toBe('m2');
    });

    it('ignores an entry written under an older cache shape', async () => {
        localStorage.setItem(
            LIST_KEY,
            JSON.stringify({ at: Date.now(), markets: [row('m1', 'Chợ A')] })
        );
        const get = spyOn(marketsApi, 'apiV1MarketsGetRaw').and.resolveTo(
            envelope([row('m1', 'Chợ A')])
        );

        await new MarketSelectionService().ensureLoaded();

        expect(get).toHaveBeenCalledTimes(1);
    });

    it('bypasses the cache on reload, so the retry reaches the server', async () => {
        const get = spyOn(marketsApi, 'apiV1MarketsGetRaw').and.resolveTo(
            envelope([row('m1', 'Chợ A')])
        );
        const service = new MarketSelectionService();
        await service.ensureLoaded();

        await service.reload();

        expect(get).toHaveBeenCalledTimes(2);
    });

    it('drops a remembered market the cached list no longer holds', async () => {
        localStorage.setItem(
            SELECTED_KEY,
            JSON.stringify({ id: 'gone', name: 'Chợ cũ' })
        );
        localStorage.setItem(
            LIST_KEY,
            JSON.stringify({
                v: 1,
                at: Date.now(),
                markets: [row('m1', 'Chợ A')],
            })
        );

        const service = new MarketSelectionService();

        expect(service.selected()).toBeNull();
        expect(localStorage.getItem(SELECTED_KEY)).toBeNull();
    });
});
