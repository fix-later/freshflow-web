import { parseConfirmPreview } from './confirm-preview';

/**
 * Names captured from the live backend. None of them were in the lists the
 * parser matched on, so the verdict always fell through to the tolerant
 * default of `true`: the gate never fired, refusal reasons never reached the
 * buyer, and the credit figure was always `null`.
 */
describe('parseConfirmPreview', () => {
    it('reads the live field names', () => {
        const preview = parseConfirmPreview({
            wouldSucceed: true,
            issues: [],
            totalAmount: 110000,
            resolvedScheduledFor: '2026-08-06T05:59:40.433Z',
            remainingCreditAfter: 790000,
        });

        expect(preview.canConfirm).toBeTrue();
        expect(preview.totalAmount).toBe(110000);
        expect(preview.availableCredit).toBe(790000);
        expect(preview.resolvedScheduledFor).toBe('2026-08-06T05:59:40.433Z');
    });

    it('blocks and surfaces the reasons when wouldSucceed is false', () => {
        const preview = parseConfirmPreview({
            wouldSucceed: false,
            issues: [
                // The live shape: code *and* the backend's English message.
                {
                    code: 'CREDIT_LIMIT_EXCEEDED',
                    message: 'Requested amount 120 exceeds available credit 80',
                },
                { message: 'Past cutoff' },
                'DELIVERY_DATE_OUT_OF_WINDOW',
            ],
        });

        expect(preview.canConfirm).toBeFalse();
        expect(preview.blockers).toEqual([
            {
                code: 'CREDIT_LIMIT_EXCEEDED',
                message: 'Requested amount 120 exceeds available credit 80',
            },
            { code: null, message: 'Past cutoff' },
            // A bare string that looks like a code is kept as one, so it can
            // still be localized rather than shown verbatim.
            { code: 'DELIVERY_DATE_OUT_OF_WINDOW', message: null },
        ]);
    });

    it('still allows the confirm when the body is unrecognisable', () => {
        const preview = parseConfirmPreview({ somethingElse: 1 });
        expect(preview.canConfirm).toBeTrue();
        expect(preview.blockers).toEqual([]);
        expect(preview.totalAmount).toBeNull();
    });

    it('survives an empty or missing body', () => {
        expect(parseConfirmPreview(null).canConfirm).toBeTrue();
        expect(parseConfirmPreview(undefined).blockers).toEqual([]);
    });

    it('still honours the older aliases', () => {
        expect(
            parseConfirmPreview({ canConfirm: false, blockers: ['nope'] })
        ).toEqual(
            jasmine.objectContaining({
                canConfirm: false,
                blockers: [{ code: null, message: 'nope' }],
            })
        );
    });
});
