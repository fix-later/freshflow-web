import { bucketIncidents } from './incident-trend';
import { IncidentSource } from './incidents.types';

const NOW = new Date('2026-08-17T10:00:00');

function row(source: IncidentSource, reportedAt: string | null) {
    return { source, reportedAt };
}

describe('bucketIncidents', () => {
    it('lays one bucket per day across the window, ending today', () => {
        const trend = bucketIncidents(
            [
                row('procurement', '2026-08-17T02:00:00'),
                row('procurement', '2026-08-17T23:00:00'),
                row('hub', '2026-08-15T08:00:00'),
            ],
            7,
            NOW
        );

        expect(trend.weekly).toBeFalse();
        expect(trend.buckets).toHaveSize(7);
        expect(trend.buckets.at(-1)).toEqual(
            jasmine.objectContaining({ procurement: 2, hub: 0 })
        );
        expect(trend.buckets.at(-3)).toEqual(
            jasmine.objectContaining({ procurement: 0, hub: 1 })
        );
    });

    it('switches to weekly buckets past a month, keeping the source split', () => {
        const trend = bucketIncidents(
            [
                row('hub', '2026-08-17T02:00:00'),
                row('hub', '2026-08-12T02:00:00'),
                row('procurement', '2026-06-10T02:00:00'),
            ],
            90,
            NOW
        );

        expect(trend.weekly).toBeTrue();
        expect(trend.buckets).toHaveSize(13);
        // The two hub rows are five days apart, which is a week boundary here.
        expect(trend.buckets.at(-1)?.hub).toBe(1);
        expect(trend.buckets.at(-2)?.hub).toBe(1);
        expect(
            trend.buckets.reduce((sum, bucket) => sum + bucket.procurement, 0)
        ).toBe(1);
    });

    it('spans from the earliest report when no window is selected', () => {
        const trend = bucketIncidents(
            [row('procurement', '2026-08-13T02:00:00')],
            null,
            NOW
        );

        expect(trend.weekly).toBeFalse();
        expect(trend.buckets).toHaveSize(5);
        expect(trend.buckets[0].procurement).toBe(1);
    });

    it('drops rows the time axis cannot place instead of miscounting them', () => {
        const trend = bucketIncidents(
            [
                row('hub', null),
                row('hub', 'not-a-date'),
                // Older than the window: kept out of the chart, not of the list.
                row('procurement', '2026-01-01T02:00:00'),
            ],
            7,
            NOW
        );

        expect(trend.buckets).toHaveSize(7);
        expect(
            trend.buckets.reduce(
                (sum, bucket) => sum + bucket.hub + bucket.procurement,
                0
            )
        ).toBe(0);
    });

    it('always returns at least one bucket for an empty report', () => {
        const trend = bucketIncidents([], null, NOW);

        expect(trend.buckets).toHaveSize(1);
        expect(trend.buckets[0]).toEqual(
            jasmine.objectContaining({ procurement: 0, hub: 0 })
        );
    });
});
