import { earliestDeliveryDate } from './checkout.component';

describe('earliestDeliveryDate', () => {
    it('returns tomorrow before the 22:00 cutoff', () => {
        const now = new Date(2026, 6, 13, 21, 59, 0); // 13 Jul 2026 21:59
        const earliest = earliestDeliveryDate(now);
        expect(earliest.getFullYear()).toBe(2026);
        expect(earliest.getMonth()).toBe(6);
        expect(earliest.getDate()).toBe(14);
    });

    it('returns day-after-tomorrow from 22:00 onward', () => {
        const now = new Date(2026, 6, 13, 22, 0, 0); // 13 Jul 2026 22:00
        const earliest = earliestDeliveryDate(now);
        expect(earliest.getFullYear()).toBe(2026);
        expect(earliest.getMonth()).toBe(6);
        expect(earliest.getDate()).toBe(15);
    });
});
