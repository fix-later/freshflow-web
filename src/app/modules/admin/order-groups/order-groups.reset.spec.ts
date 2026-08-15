import { DateTime } from 'luxon';
import { resetConfirmationPhraseForDate } from './order-groups.component';

describe('resetConfirmationPhraseForDate', () => {
    it('matches the backend RESET yyyy-MM-dd contract', () => {
        const date = DateTime.fromISO('2026-08-16');

        expect(resetConfirmationPhraseForDate(date)).toBe('RESET 2026-08-16');
    });

    it('returns null when no valid date is selected', () => {
        expect(resetConfirmationPhraseForDate(null)).toBeNull();
        expect(
            resetConfirmationPhraseForDate(DateTime.fromISO('not-a-date'))
        ).toBeNull();
    });
});
