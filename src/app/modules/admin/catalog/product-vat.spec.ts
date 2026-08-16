import { PRODUCT_VAT_RATES, vatRateLabel, vatRateOf } from './product-vat';

const label = (key: string): string => `[${key}]`;

/**
 * `Product.VatRate` is a code, not a number: four of the six values are
 * percentages and two are Vietnamese invoicing categories. The backend
 * normalizes to upper case and refuses anything outside the set.
 */
describe('product VAT rate', () => {
    it('offers exactly the codes the backend accepts', () => {
        expect([...PRODUCT_VAT_RATES]).toEqual([
            'KCT',
            'KKKNT',
            '0',
            '5',
            '8',
            '10',
        ]);
    });

    it('renders the numeric codes as percentages', () => {
        expect(vatRateLabel('0', label)).toBe('0%');
        expect(vatRateLabel('8', label)).toBe('8%');
        expect(vatRateLabel('10', label)).toBe('10%');
    });

    it('translates the two category codes', () => {
        expect(vatRateLabel('KCT', label)).toBe('[admin.products.vat.kct]');
        expect(vatRateLabel('KKKNT', label)).toBe('[admin.products.vat.kkknt]');
    });

    /** Null is a state, not missing data: invoicing reads it as KCT. */
    it('names the unset state rather than showing a blank', () => {
        expect(vatRateLabel(null, label)).toBe('[admin.products.vat.notSet]');
        expect(vatRateLabel('', label)).toBe('[admin.products.vat.notSet]');
        expect(vatRateLabel('   ', label)).toBe('[admin.products.vat.notSet]');
    });

    it('reads a stored code however the row spells it', () => {
        expect(vatRateOf('kct')).toBe('KCT');
        expect(vatRateOf(' 10 ')).toBe('10');
        expect(vatRateOf(null)).toBe('');
    });

    /**
     * A code this build does not know is shown as itself: the backend may add
     * one before the web catches up, and the raw token is more use on screen
     * than a blank cell or a raw i18n key.
     */
    it('shows an unrecognised code as itself', () => {
        expect(vatRateLabel('KHAC', label)).toBe('KHAC');
    });
});
