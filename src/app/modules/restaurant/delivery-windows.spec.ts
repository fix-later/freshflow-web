import {
    DELIVERY_WINDOWS,
    windowFromTimes,
    windowFromTimestamp,
    windowsWithin,
} from './delivery-windows';

describe('windowsWithin', () => {
    it('offers only the window the profile declares', () => {
        expect(windowsWithin('09:00:00', '11:00:00')).toEqual(['09:00-11:00']);
    });

    it('offers every window that fits wider declared hours', () => {
        expect(windowsWithin('06:00:00', '18:00:00')).toEqual([
            ...DELIVERY_WINDOWS,
        ]);
        expect(windowsWithin('09:00:00', '16:00:00')).toEqual([
            '09:00-11:00',
            '14:00-16:00',
        ]);
    });

    it('does not restrict a profile with no window set', () => {
        expect(windowsWithin(null, null)).toEqual([...DELIVERY_WINDOWS]);
        expect(windowsWithin('09:00:00', null)).toEqual([...DELIVERY_WINDOWS]);
    });

    /**
     * Profiles saved before the window list existed hold free-form times.
     * Filtering those to nothing would leave checkout with an empty picker and
     * no way to order at all.
     */
    it('falls back to every window when the declared hours fit none', () => {
        expect(windowsWithin('08:30:00', '08:45:00')).toEqual([
            ...DELIVERY_WINDOWS,
        ]);
    });

    it('accepts HH:mm as well as HH:mm:ss', () => {
        expect(windowsWithin('09:00', '11:00')).toEqual(['09:00-11:00']);
    });
});

describe('windowFromTimes', () => {
    it('recognises an exact window', () => {
        expect(windowFromTimes('14:00:00', '16:00:00')).toBe('14:00-16:00');
    });

    it('returns null for hours that match no window', () => {
        expect(windowFromTimes('08:30:00', '12:00:00')).toBeNull();
        expect(windowFromTimes(null, null)).toBeNull();
    });
});

describe('windowFromTimestamp', () => {
    /** Orders carry the *start* of the slot — see `_scheduledFor`. */
    it('reads back the window an order was placed for', () => {
        const placed = new Date(2026, 7, 10, 14, 0, 0);
        expect(windowFromTimestamp(placed)).toBe('14:00-16:00');
        expect(windowFromTimestamp(placed.toISOString())).toBe('14:00-16:00');
    });

    it('returns null for a time that starts no window', () => {
        expect(windowFromTimestamp(new Date(2026, 7, 10, 13, 0, 0))).toBeNull();
    });

    it('returns null for missing or unparsable input', () => {
        expect(windowFromTimestamp(null)).toBeNull();
        expect(windowFromTimestamp(undefined)).toBeNull();
        expect(windowFromTimestamp('not-a-date')).toBeNull();
    });
});
