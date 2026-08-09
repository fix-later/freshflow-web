import { formatRelativeTime } from './relative-time';

/**
 * The value this produces qualifies a price on the storefront, so what matters
 * is that it never renders a placeholder for bad input and never reads as a
 * future event when the server clock runs ahead of the browser's.
 */
describe('formatRelativeTime', () => {
    const agoIso = (seconds: number) =>
        new Date(Date.now() - seconds * 1000).toISOString();

    it('picks the largest unit the elapsed time clears', () => {
        expect(formatRelativeTime(agoIso(2 * 60 * 60), 'en')).toBe(
            '2 hours ago'
        );
        expect(formatRelativeTime(agoIso(3 * 24 * 60 * 60), 'en')).toBe(
            '3 days ago'
        );
    });

    it('localizes through the platform rather than translation strings', () => {
        expect(formatRelativeTime(agoIso(2 * 60 * 60), 'vi')).toContain(
            'giờ trước'
        );
    });

    it('reports a future timestamp as now, not as a countdown', () => {
        const ahead = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        const result = formatRelativeTime(ahead, 'en');

        expect(result).toBe('now');
    });

    it('returns null for a missing or unparseable value', () => {
        expect(formatRelativeTime('', 'en')).toBeNull();
        expect(formatRelativeTime(null, 'en')).toBeNull();
        expect(formatRelativeTime(undefined, 'en')).toBeNull();
        expect(formatRelativeTime('not a date', 'en')).toBeNull();
    });
});
