import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { CrudRow } from '../shared/resource-crud.types';
import { CatalogAdminService } from './catalog-admin.service';
import { MarketProductsComponent } from './market-products.component';

/** Minimal Transloco loader — no label in this file is under test. */
class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

const MARKET_ID = 'market-1';

/** Two listings, enough to tell "the row I edited" from "the other one". */
function storedProducts(): CrudRow[] {
    return [
        {
            id: 'p-1',
            productId: 'p-1',
            productName: 'Rau muống',
            price: 12000,
            availableQuantity: 8,
            tags: [{ id: 'tag-a', name: 'Fresh', pinsToTop: false }],
        },
        {
            id: 'p-2',
            productId: 'p-2',
            productName: 'Cà chua',
            price: 25000,
            availableQuantity: 3,
            tags: [],
        },
    ];
}

/**
 * Records what the batch actually sent. The point of the screen is that an
 * untouched field produces no call at all, which can only be asserted by
 * counting calls — a stub that merely resolves would pass either way.
 */
class StubCatalogAdminService {
    priceCalls: { productId: string; price: number }[] = [];
    quantityCalls: { productId: string; quantity: number }[] = [];
    tagCalls: { productId: string; tagIds: readonly string[] }[] = [];
    /** Product ids the server refuses, for the partial-failure case. */
    rejectPriceFor = new Set<string>();

    listMarketProducts(): Promise<CrudRow[]> {
        return Promise.resolve(storedProducts());
    }

    updateMarketPrice(
        _marketId: string,
        productId: string,
        price: number
    ): Promise<void> {
        this.priceCalls.push({ productId, price });
        return this.rejectPriceFor.has(productId)
            ? Promise.reject(new Error('refused'))
            : Promise.resolve();
    }

    updateMarketQuantity(
        _marketId: string,
        productId: string,
        quantity: number
    ): Promise<void> {
        this.quantityCalls.push({ productId, quantity });
        return Promise.resolve();
    }

    setMarketProductTags(
        _marketId: string,
        productId: string,
        tagIds: readonly string[]
    ): Promise<void> {
        this.tagCalls.push({ productId, tagIds });
        return Promise.resolve();
    }

    listAllProductsForSelection(): Promise<CrudRow[]> {
        return Promise.resolve([]);
    }

    listTags(): Promise<CrudRow[]> {
        return Promise.resolve([]);
    }

    listCategories(): Promise<CrudRow[]> {
        return Promise.resolve([]);
    }
}

interface Harness {
    component: MarketProductsComponent;
    catalog: StubCatalogAdminService;
}

/** Lets every already-queued promise settle before the assertions run. */
function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

async function createHarness(): Promise<Harness> {
    const catalog = new StubCatalogAdminService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        imports: [MarketProductsComponent],
        providers: [
            provideRouter([]),
            provideTransloco({
                config: { availableLangs: ['en'], defaultLang: 'en' },
                loader: StubTranslocoLoader,
            }),
            {
                provide: CatalogAdminService,
                useValue: catalog as unknown as CatalogAdminService,
            },
        ],
    });
    const fixture = TestBed.createComponent(MarketProductsComponent);
    // `setInput` + an explicit `load()` rather than `detectChanges()`: the tab
    // passes the market in as an input, and this way the picker and the tag
    // catalog are not read as a side effect of every test.
    fixture.componentRef.setInput('marketId', MARKET_ID);
    fixture.componentInstance.load();
    await flush();
    return { component: fixture.componentInstance, catalog };
}

describe('MarketProductsComponent — batch save', () => {
    it('has nothing to save when the grid is untouched', async () => {
        const { component } = await createHarness();

        expect(component.changedCount()).toBe(0);
        expect(component.canSaveAll()).toBe(false);
    });

    it('sends only the field that changed, on only the row that changed', async () => {
        const { component, catalog } = await createHarness();

        component.setPriceDraft('p-1', 13500);
        expect(component.changedCount()).toBe(1);
        expect(component.isChanged('p-1')).toBe(true);
        expect(component.isChanged('p-2')).toBe(false);

        component.saveAll();
        await flush();

        expect(catalog.priceCalls).toEqual([
            { productId: 'p-1', price: 13500 },
        ]);
        // The quantity and the tags on that row were never touched, so the
        // endpoints behind them are never called.
        expect(catalog.quantityCalls).toEqual([]);
        expect(catalog.tagCalls).toEqual([]);
    });

    it('carries every edited row in one batch', async () => {
        const { component, catalog } = await createHarness();

        component.setPriceDraft('p-1', 13500);
        component.setQuantityDraft('p-2', 11);
        component.setTagsDraft('p-2', ['tag-a']);

        expect(component.changedCount()).toBe(2);

        component.saveAll();
        await flush();

        expect(catalog.priceCalls).toEqual([
            { productId: 'p-1', price: 13500 },
        ]);
        expect(catalog.quantityCalls).toEqual([
            { productId: 'p-2', quantity: 11 },
        ]);
        expect(catalog.tagCalls).toEqual([
            { productId: 'p-2', tagIds: ['tag-a'] },
        ]);
    });

    it('treats a value typed back to its original as no change at all', async () => {
        const { component, catalog } = await createHarness();

        component.setPriceDraft('p-1', 99000);
        expect(component.changedCount()).toBe(1);

        component.setPriceDraft('p-1', 12000);
        expect(component.changedCount()).toBe(0);

        component.saveAll();
        await flush();

        expect(catalog.priceCalls).toEqual([]);
    });

    it('does not rewrite a tag set that was only reselected', async () => {
        const { component, catalog } = await createHarness();

        // The same one tag the listing already carries. The endpoint replaces
        // the whole set, so an identical set is a write with no effect.
        component.setTagsDraft('p-1', ['tag-a']);
        expect(component.changedCount()).toBe(0);

        component.saveAll();
        await flush();

        expect(catalog.tagCalls).toEqual([]);
    });

    it('refuses the whole batch while any row is invalid', async () => {
        const { component, catalog } = await createHarness();

        component.setPriceDraft('p-1', 13500);
        component.setPriceDraft('p-2', 0);

        expect(component.invalidCount()).toBe(1);
        expect(component.rowErrorKey('p-2')).toBe(
            'admin.markets.pricing.pricePositive'
        );
        expect(component.canSaveAll()).toBe(false);

        component.saveAll();
        await flush();

        // Not even the valid row goes out: half a batch is worse than none,
        // because the admin cannot tell which half.
        expect(catalog.priceCalls).toEqual([]);
    });

    it('reads a cleared price as an edit that has to be fixed or undone', async () => {
        const { component } = await createHarness();

        component.setPriceDraft('p-1', null);

        expect(component.isChanged('p-1')).toBe(true);
        expect(component.rowErrorKey('p-1')).toBe(
            'admin.markets.pricing.priceRequired'
        );
        expect(component.canSaveAll()).toBe(false);
    });

    it('puts one row back without touching the rest of the batch', async () => {
        const { component } = await createHarness();

        component.setPriceDraft('p-1', 13500);
        component.setQuantityDraft('p-2', 11);

        component.revertRow('p-1');

        expect(component.isChanged('p-1')).toBe(false);
        expect(component.isChanged('p-2')).toBe(true);
        expect(component.changedCount()).toBe(1);
    });

    it('keeps the edits of a row the server refused, and drops the ones that landed', async () => {
        const { component, catalog } = await createHarness();
        catalog.rejectPriceFor.add('p-2');

        component.setPriceDraft('p-1', 13500);
        component.setPriceDraft('p-2', 26000);

        component.saveAll();
        await flush();
        await flush();

        // The refresh that follows the failure must not overwrite the edit the
        // admin now has to retry — while the row that saved is back in step
        // with the server.
        expect(component.isChanged('p-2')).toBe(true);
        expect(component.priceDraft()['p-2']).toBe(26000);
        expect(component.isChanged('p-1')).toBe(false);
        expect(component.saveError()).toBeTruthy();
    });
});
