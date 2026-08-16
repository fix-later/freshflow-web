import { invoiceStatusPillClass } from './status-pills';

/**
 * The storefront used to keep its own copy of this, and the copy had drifted
 * off the API: it coloured `paid`, `overdue`, `void` and `draft` — none of
 * which `InvoiceStatus` emits — while `PendingIssuance`, which it does emit on
 * every unissued invoice, fell through to neutral. A restaurant's invoice list
 * and the admin's therefore coloured the same row differently.
 */
describe('invoiceStatusPillClass — one vocabulary for both sides', () => {
    it('colours the statuses the invoice API actually sends', () => {
        expect(invoiceStatusPillClass('issued')).toContain('success');
        expect(invoiceStatusPillClass('cancelled')).toContain('danger');
    });

    it('reads the unissued state in either casing the API uses', () => {
        // `PendingIssuance` from the enum's `ToString()`, `pending_issuance`
        // from the mapped list responses.
        expect(invoiceStatusPillClass('PendingIssuance')).toContain('warning');
        expect(invoiceStatusPillClass('pending_issuance')).toContain('warning');
    });

    it('leaves a status it does not know neutral rather than guessing', () => {
        expect(invoiceStatusPillClass('something_new')).toContain('neutral');
        expect(invoiceStatusPillClass(null)).toContain('neutral');
    });
});
