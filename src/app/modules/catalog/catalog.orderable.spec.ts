import { CatalogProduct, isOrderableListing } from './catalog.types';

const listing = (patch: Partial<CatalogProduct>): CatalogProduct =>
    ({
        id: 'p-1',
        name: 'Cải ngọt',
        quantity: 100,
        totalQuantity: 100,
        packWeightKg: 20,
        ...patch,
    }) as CatalogProduct;

/**
 * Goods move by the case, so "less than one case left" is not a smaller offer —
 * it is no offer. The board hid neither case before, leaving tiles whose add
 * button could not be pressed.
 */
describe('isOrderableListing', () => {
    it('keeps a listing with at least one whole case', () => {
        expect(isOrderableListing(listing({}))).toBeTrue();
        // Exactly one case is still a case.
        expect(
            isOrderableListing(listing({ quantity: 20, packWeightKg: 20 }))
        ).toBeTrue();
    });

    it('drops a listing with nothing left', () => {
        expect(isOrderableListing(listing({ quantity: 0 }))).toBeFalse();
    });

    it('drops a listing holding less than one case', () => {
        expect(
            isOrderableListing(listing({ quantity: 19, packWeightKg: 20 }))
        ).toBeFalse();
    });

    /** Unreported is not empty — the market simply did not state a figure. */
    it('keeps a listing that reports no quantity at all', () => {
        expect(isOrderableListing(listing({ quantity: null }))).toBeTrue();
    });

    /**
     * No case to sell by at all, however much stock is on hand — the listing is
     * a catalog gap, not an offer, so it waits out of sight until an admin
     * gives the product a packing code.
     */
    it('drops a listing with no packing code, whatever its stock', () => {
        expect(
            isOrderableListing(listing({ quantity: 300, packWeightKg: null }))
        ).toBeFalse();
        expect(
            isOrderableListing(listing({ quantity: 300, packWeightKg: 0 }))
        ).toBeFalse();
        // Including the case an unreported quantity would otherwise let through.
        expect(
            isOrderableListing(listing({ quantity: null, packWeightKg: null }))
        ).toBeFalse();
    });
});
