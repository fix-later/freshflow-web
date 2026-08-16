import { IncidentSource } from './incidents.types';

/** The two counts a bucket carries, plus the local midnight it starts at. */
export interface IncidentBucket {
    /** Bucket start as epoch ms at local midnight — the caller formats it. */
    start: number;
    procurement: number;
    hub: number;
}

export interface IncidentTrend {
    buckets: IncidentBucket[];
    /** True when a bucket is a week rather than a day — changes the label. */
    weekly: boolean;
}

/** Only the two fields the bucketing needs, so callers can pass rows as they are. */
export interface DatedIncident {
    source: IncidentSource;
    reportedAt: string | null;
}

const DAY_MS = 86_400_000;
/** Past this many columns a daily chart stops being readable, so it goes weekly. */
const MAX_DAILY_BUCKETS = 31;
/** Weekly ceiling — half a year of columns, for the unbounded "all" window. */
const MAX_WEEKLY_BUCKETS = 26;

function startOfDay(value: number): number {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function timeOf(reportedAt: string | null): number | null {
    if (!reportedAt) {
        return null;
    }
    const parsed = Date.parse(reportedAt);
    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Counts incidents into equal buckets ending today, split by source.
 *
 * `windowDays` is the selected period, or `null` for "everything" — in which
 * case the span runs from the earliest report. The bucket size follows the
 * span rather than the selection: a quarter drawn as 90 columns is unreadable,
 * so anything past a month is bucketed by week. Reports older than the first
 * bucket are dropped from the chart (never from the counts or the list), which
 * is what caps "all" at {@link MAX_WEEKLY_BUCKETS}.
 *
 * Rows with no `reportedAt` cannot be placed on a time axis and are skipped
 * here; the report shows them everywhere else.
 */
export function bucketIncidents(
    rows: readonly DatedIncident[],
    windowDays: number | null,
    now: Date = new Date()
): IncidentTrend {
    const today = startOfDay(now.getTime());
    const times = rows
        .map((row) => timeOf(row.reportedAt))
        .filter((time): time is number => time !== null);
    const earliest = times.length ? startOfDay(Math.min(...times)) : today;
    const spanDays = windowDays ?? Math.floor((today - earliest) / DAY_MS) + 1;
    const weekly = spanDays > MAX_DAILY_BUCKETS;
    const step = weekly ? 7 : 1;
    const count = Math.max(
        1,
        Math.min(
            weekly ? MAX_WEEKLY_BUCKETS : MAX_DAILY_BUCKETS,
            Math.ceil(spanDays / step)
        )
    );

    const buckets: IncidentBucket[] = Array.from({ length: count }, (_, i) => ({
        start: today - (count - 1 - i) * step * DAY_MS,
        procurement: 0,
        hub: 0,
    }));
    const first = buckets[0].start;

    for (const row of rows) {
        const time = timeOf(row.reportedAt);
        if (time === null) {
            continue;
        }
        const day = startOfDay(time);
        if (day < first) {
            continue;
        }
        const index = Math.min(
            buckets.length - 1,
            Math.floor((day - first) / (step * DAY_MS))
        );
        buckets[index][row.source === 'hub' ? 'hub' : 'procurement'] += 1;
    }

    return { buckets, weekly };
}
