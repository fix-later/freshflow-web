import { translateCreditNote } from './credit-note';

/** Stands in for `TranslocoService.translate`, echoing key + params. */
const translate = (key: string, params?: Record<string, unknown>): string => {
    const labels: Record<string, string> = {
        'creditNote.orderConfirmed': 'Xác nhận đơn hàng',
        'creditNote.orderCancelled': 'Đơn hàng đã hủy',
        'creditNote.procurementBatchCancelled': 'Phiên thu mua đã hủy',
        'creditNote.claimApproved': 'Khiếu nại được duyệt',
        'creditNote.hubDiscrepancy': `Lệch hàng tại hub (phiếu ${params?.['discrepancy']}, dòng hàng ${params?.['item']})`,
    };
    return labels[key] ?? key;
};

/**
 * The backend writes some ledger notes itself and an operator writes the rest.
 * The system's own sentences have to be translated — a Vietnamese restaurant was
 * reading "Order confirmed" in its own ledger — and a person's words must not be
 * touched, which is the pair of risks these cover.
 */
describe('translateCreditNote', () => {
    it('translates the sentences the backend writes', () => {
        expect(translateCreditNote('Order confirmed', translate)).toBe(
            'Xác nhận đơn hàng'
        );
        expect(translateCreditNote('Order cancelled', translate)).toBe(
            'Đơn hàng đã hủy'
        );
        expect(
            translateCreditNote('Procurement batch cancelled', translate)
        ).toBe('Phiên thu mua đã hủy');
    });

    it('keeps the reviewer’s own words after a translated prefix', () => {
        expect(
            translateCreditNote(
                'Claim approved: hàng dập, giảm 50% dòng cà chua',
                translate
            )
        ).toBe('Khiếu nại được duyệt: hàng dập, giảm 50% dòng cà chua');
    });

    it('keeps the ids in a hub discrepancy refund', () => {
        expect(
            translateCreditNote(
                'Hub discrepancy d-1 refund for order item i-9.',
                translate
            )
        ).toBe('Lệch hàng tại hub (phiếu d-1, dòng hàng i-9)');
    });

    it('passes an operator note through untouched', () => {
        const note = 'Nhà hàng chuyển khoản VCB, đã đối chiếu sao kê';
        expect(translateCreditNote(note, translate)).toBe(note);
    });

    it('passes an unrecognised system note through rather than blanking it', () => {
        // A backend that adds a note ships it before the translation lands.
        expect(translateCreditNote('Order rescheduled', translate)).toBe(
            'Order rescheduled'
        );
    });

    it('is empty for an empty note', () => {
        expect(translateCreditNote(null, translate)).toBe('');
        expect(translateCreditNote('   ', translate)).toBe('');
    });
});
