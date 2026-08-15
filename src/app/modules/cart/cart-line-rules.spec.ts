import { DraftOrderLine } from 'app/layout/common/draft-order/draft-order.types';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { caseCount, packSize } from './cart-line-rules';

/**
 * `caseCount` is what every cart surface now prints, while the quantity it
 * divides is what gets sent. A wrong divisor here misstates the quantity on
 * screen without failing anything else, so the two representations are pinned
 * apart deliberately: each case asserts the display *and* that the underlying
 * kilograms are untouched.
 */
function line(quantity: number, packWeightKg: number | null): DraftOrderLine {
    return {
        product: { packWeightKg } as CatalogProduct,
        quantity,
        unitPrice: 46_000,
    };
}

describe('caseCount', () => {
    it('divides kilograms by the case size', () => {
        const subject = line(15, 5);

        expect(caseCount(subject)).toBe(3);
        // The wire format is untouched — the cart still holds kilograms.
        expect(subject.quantity).toBe(15);
    });

    it('counts a single case as 1, not as its weight', () => {
        expect(caseCount(line(30, 30))).toBe(1);
    });

    it('falls back to kilograms when the product has no packing code', () => {
        // `packSize` answers 1 there, so the division is a no-op and the row
        // keeps showing the only figure it has.
        expect(packSize(line(12, null))).toBe(1);
        expect(caseCount(line(12, null))).toBe(12);
    });

    it('reports a fraction rather than restating a legacy line as whole cases', () => {
        // Not reachable through the stepper, which only ever moves by a whole
        // case; reachable by a cart restored from before the case size changed.
        expect(caseCount(line(17, 5))).toBe(3.4);
    });
});
