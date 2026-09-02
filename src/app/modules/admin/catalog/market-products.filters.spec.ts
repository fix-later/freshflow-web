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

/**
 * Four listings spanning what the header filters have to tell apart: two
 * children of the same parent, two top-level categories, one listing of each
 * stock band, and a tag shared across two categories.
 */
function storedProducts(): CrudRow[] {
    return [
        {
            id: 'p-1',
            productId: 'p-1',
            productName: 'Rau muống',
            category: 'Rau ăn lá',
            price: 12000,
            availableQuantity: 8,
            tags: [{ id: 'tag-a', name: 'Tươi', pinsToTop: false }],
        },
        {
            id: 'p-2',
            productId: 'p-2',
            productName: 'Cà chua',
            category: 'Rau củ',
            price: 25000,
            availableQuantity: 0,
            tags: [],
        },
        {
            id: 'p-3',
            productId: 'p-3',
            productName: 'Cá thu',
            category: 'Hải sản',
            price: 180000,
            availableQuantity: 40,
            tags: [{ id: 'tag-a', name: 'Tươi', pinsToTop: false }],
        },
        {
            id: 'p-4',
            productId: 'p-4',
            productName: 'Thịt bò',
            category: 'Thịt',
            price: 320000,
            availableQuantity: 3,
            tags: [{ id: 'tag-b', name: 'Khuyến mãi', pinsToTop: false }],
        },
    ];
}

/** The category catalog behind the parent/child pair: two levels, three roots. */
function storedCategories(): CrudRow[] {
    return [
        { id: 'c-1', name: 'Rau', parentName: '' },
        { id: 'c-2', name: 'Rau ăn lá', parentName: 'Rau' },
        { id: 'c-3', name: 'Rau củ', parentName: 'Rau' },
        { id: 'c-4', name: 'Hải sản', parentName: '' },
        { id: 'c-5', name: 'Thịt', parentName: '' },
    ];
}

class StubCatalogAdminService {
    listMarketProducts(): Promise<CrudRow[]> {
        return Promise.resolve(storedProducts());
    }

    listAllProductsForSelection(): Promise<CrudRow[]> {
        return Promise.resolve([]);
    }

    listTags(): Promise<CrudRow[]> {
        return Promise.resolve([]);
    }

    listCategories(): Promise<CrudRow[]> {
        return Promise.resolve(storedCategories());
    }
}

/** Lets every already-queued promise settle before the assertions run. */
function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The ids the header filters left, in list order. */
function visibleIds(component: MarketProductsComponent): string[] {
    return component.filteredRows().map((row) => row.productId);
}

async function createComponent(): Promise<MarketProductsComponent> {
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
                useValue:
                    new StubCatalogAdminService() as unknown as CatalogAdminService,
            },
        ],
    });
    const fixture = TestBed.createComponent(MarketProductsComponent);
    // Embedded, as the market detail tab mounts it: that is the branch the
    // filter toolbar renders in, and it skips the market-name lookup.
    fixture.componentRef.setInput('marketId', MARKET_ID);
    fixture.componentRef.setInput('embedded', true);
    // `detectChanges()` for `ngOnInit`, which is what loads the category
    // parents the parent/child pair reads.
    fixture.detectChanges();
    await flush();
    return fixture.componentInstance;
}

describe('MarketProductsComponent — header filters', () => {
    it('offers every top-level category, children folded into their parent', async () => {
        const component = await createComponent();

        // "Rau" is listed even though no product sits directly under it, and
        // its two children are not — they belong to the child select.
        expect(component.parentCategoryOptions()).toEqual([
            'Hải sản',
            'Rau',
            'Thịt',
        ]);
    });

    it('keeps a parent filter over the children filed under it', async () => {
        const component = await createComponent();

        component.setParentCategoryFilter('Rau');

        expect(visibleIds(component)).toEqual(['p-1', 'p-2']);
        expect(component.categoryOptions()).toEqual(['Rau ăn lá', 'Rau củ']);
    });

    it('keeps a top-level category that products are filed under directly', async () => {
        const component = await createComponent();

        component.setParentCategoryFilter('Hải sản');

        expect(visibleIds(component)).toEqual(['p-3']);
        // Nothing sits under it, so the child select has nothing to offer.
        expect(component.categoryOptions()).toEqual([]);
    });

    it('narrows to one child of the picked parent', async () => {
        const component = await createComponent();

        component.setParentCategoryFilter('Rau');
        component.setCategoryFilter('Rau củ');

        expect(visibleIds(component)).toEqual(['p-2']);
    });

    it('drops a child the newly picked parent does not have', async () => {
        const component = await createComponent();

        component.setParentCategoryFilter('Rau');
        component.setCategoryFilter('Rau củ');
        component.setParentCategoryFilter('Thịt');

        expect(component.categoryFilter()).toBe('');
        expect(visibleIds(component)).toEqual(['p-4']);
    });

    it('separates the three stock bands, low stock inside in-stock', async () => {
        const component = await createComponent();

        component.setStockFilter('out');
        expect(visibleIds(component)).toEqual(['p-2']);

        component.setStockFilter('low');
        expect(visibleIds(component)).toEqual(['p-1', 'p-4']);

        // A low listing is still sellable, so it stays in the in-stock list.
        component.setStockFilter('in');
        expect(visibleIds(component)).toEqual(['p-1', 'p-3', 'p-4']);
    });

    it('filters by a tag, across categories', async () => {
        const component = await createComponent();

        expect(component.tagFilterOptions()).toEqual([
            { id: 'tag-b', name: 'Khuyến mãi' },
            { id: 'tag-a', name: 'Tươi' },
        ]);

        component.setTagFilter('tag-a');

        expect(visibleIds(component)).toEqual(['p-1', 'p-3']);
    });

    it('combines the filters rather than replacing one with the next', async () => {
        const component = await createComponent();

        component.setParentCategoryFilter('Rau');
        component.setStockFilter('out');

        expect(visibleIds(component)).toEqual(['p-2']);
    });

    it('clears all four filters at once', async () => {
        const component = await createComponent();

        component.setParentCategoryFilter('Rau');
        component.setCategoryFilter('Rau củ');
        component.setStockFilter('out');
        component.setTagFilter('tag-a');
        expect(component.hasActiveFilters()).toBe(true);

        component.clearFilters();

        expect(component.hasActiveFilters()).toBe(false);
        expect(visibleIds(component)).toEqual(['p-1', 'p-2', 'p-3', 'p-4']);
    });
});
