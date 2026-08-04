import { Injectable } from '@angular/core';
import { extractList, parseJson, unwrapData } from 'app/core/api/envelope';
import { analyticsApi } from 'contract';

/**
 * A `{ label, value }` pair extracted from any of the untyped analytics
 * series. The backend names these keys inconsistently across endpoints, so
 * {@link toSeries} probes a set of candidates rather than assuming one shape.
 */
export interface AnalyticsPoint {
    label: string;
    value: number;
}

/** Untyped KPI snapshot from `GET /analytics/overview`. */
export interface AnalyticsOverview {
    [key: string]: unknown;
}

export interface AnalyticsActivity {
    id?: string;
    action?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    actorEmail?: string | null;
    description?: string | null;
    timestamp?: string | null;
    createdAt?: string | null;
    [key: string]: unknown;
}

/** One row of an ApexCharts heatmap series (`{name}` is the row/y-axis label). */
export interface HeatmapSeries {
    name: string;
    data: { x: string; y: number }[];
}

/** Keys a heatmap row may use for its row (y-axis) grouping. */
const HEATMAP_ROW_KEYS = [
    'dayOfWeek',
    'day',
    'weekday',
    'marketName',
    'region',
    'category',
];

/** Keys a heatmap row may use for its column (x-axis) bucket. */
const HEATMAP_COL_KEYS = [
    'hour',
    'hourOfDay',
    'timeSlot',
    'bucket',
    'period',
    'label',
];

/** Keys a series row may use for its category/x-axis label. */
const LABEL_KEYS = [
    'label',
    'name',
    'date',
    'day',
    'period',
    'bucket',
    'hour',
    'marketName',
    'hubName',
    'status',
];

/** Keys a series row may use for its numeric value. */
const VALUE_KEYS = [
    'value',
    'count',
    'total',
    'amount',
    'quantity',
    'orders',
    'orderCount',
    'throughput',
    'price',
    'averagePrice',
];

/** Reads the first present string-ish key, falling back to `''`. */
function pick(row: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
        const val = row[key];
        if (val != null && val !== '') {
            return String(val);
        }
    }
    return '';
}

/** Reads the first present numeric key, falling back to `0`. */
function pickNumber(row: Record<string, unknown>, keys: string[]): number {
    for (const key of keys) {
        const val = row[key];
        if (typeof val === 'number' && !Number.isNaN(val)) {
            return val;
        }
        if (typeof val === 'string' && val !== '' && !Number.isNaN(+val)) {
            return +val;
        }
    }
    return 0;
}

/**
 * Normalises an untyped analytics list body into chartable points. Rows whose
 * label *and* value are both missing are dropped so a shape mismatch renders
 * an empty chart rather than a row of zeroes.
 */
function toSeries(body: unknown): AnalyticsPoint[] {
    return extractList<Record<string, unknown>>(body)
        .map((row) => ({
            label: pick(row, LABEL_KEYS),
            value: pickNumber(row, VALUE_KEYS),
        }))
        .filter((point) => point.label !== '' || point.value !== 0);
}

/**
 * Normalises an untyped 2-dimensional demand body into ApexCharts heatmap
 * series (one series per row/y-axis grouping, each with `{x, y}` cells).
 * Field names are guessed from a candidate list, same convention as
 * {@link toSeries} — a shape mismatch degrades to a single "—" row rather
 * than throwing.
 */
function toHeatmap(body: unknown): HeatmapSeries[] {
    const rows = extractList<Record<string, unknown>>(body);
    const byRow = new Map<string, { x: string; y: number }[]>();
    for (const row of rows) {
        const rowLabel = pick(row, HEATMAP_ROW_KEYS) || '—';
        const colLabel = pick(row, HEATMAP_COL_KEYS) || '—';
        const value = pickNumber(row, VALUE_KEYS);
        const cells = byRow.get(rowLabel) ?? [];
        cells.push({ x: colLabel, y: value });
        byRow.set(rowLabel, cells);
    }
    return [...byRow.entries()].map(([name, data]) => ({ name, data }));
}

/** `Date` → `yyyy-MM-dd`, the format the analytics query strings expect. */
export function isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/**
 * Admin analytics data access (`/api/v1/analytics/*`).
 *
 * As with the rest of the admin console, the spec declares no response
 * schemas, so every body is parsed defensively via the shared envelope
 * helpers and normalised into {@link AnalyticsPoint}s for charting.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
    async getOverview(date?: string): Promise<AnalyticsOverview> {
        const res = await analyticsApi.apiV1AnalyticsOverviewGetRaw({
            date: date ? new Date(date) : undefined,
        });
        return unwrapData<AnalyticsOverview>(await parseJson(res.raw)) ?? {};
    }

    async getOrderMetrics(
        from: string,
        to: string,
        groupBy = 'day'
    ): Promise<AnalyticsPoint[]> {
        const res = await analyticsApi.apiV1AnalyticsOrderMetricsGetRaw({
            from: new Date(from),
            to: new Date(to),
            groupBy,
        });
        return toSeries(await parseJson(res.raw));
    }

    async getProcurementMetrics(
        from: string,
        to: string
    ): Promise<AnalyticsPoint[]> {
        const res = await analyticsApi.apiV1AnalyticsProcurementMetricsGetRaw({
            from: new Date(from),
            to: new Date(to),
        });
        return toSeries(await parseJson(res.raw));
    }

    async getHubThroughput(
        from: string,
        to: string
    ): Promise<AnalyticsPoint[]> {
        const res = await analyticsApi.apiV1AnalyticsHubThroughputGetRaw({
            from: new Date(from),
            to: new Date(to),
        });
        return toSeries(await parseJson(res.raw));
    }

    async getDeliveryPerformance(
        from: string,
        to: string
    ): Promise<AnalyticsPoint[]> {
        const res = await analyticsApi.apiV1AnalyticsDeliveryPerformanceGetRaw({
            from: new Date(from),
            to: new Date(to),
        });
        return toSeries(await parseJson(res.raw));
    }

    async getPriceTrends(
        from: string,
        to: string,
        interval = 'day'
    ): Promise<AnalyticsPoint[]> {
        const res = await analyticsApi.apiV1AnalyticsPriceTrendsGetRaw({
            from: new Date(from),
            to: new Date(to),
            interval,
        });
        return toSeries(await parseJson(res.raw));
    }

    async getDemandHeatmap(from: string, to: string): Promise<HeatmapSeries[]> {
        const res = await analyticsApi.apiV1AnalyticsDemandHeatmapGetRaw({
            from: new Date(from),
            to: new Date(to),
        });
        return toHeatmap(await parseJson(res.raw));
    }

    async getDemandTimeDistribution(
        from: string,
        to: string
    ): Promise<AnalyticsPoint[]> {
        const res =
            await analyticsApi.apiV1AnalyticsDemandHeatmapTimeDistributionGetRaw(
                { from: new Date(from), to: new Date(to) }
            );
        return toSeries(await parseJson(res.raw));
    }

    async getRecentActivities(pageSize = 10): Promise<AnalyticsActivity[]> {
        const res = await analyticsApi.apiV1AnalyticsRecentActivitiesGetRaw({
            page: 1,
            pageSize,
        });
        return extractList<AnalyticsActivity>(await parseJson(res.raw));
    }

    /**
     * Downloads an analytics export. The response is a file (CSV/XLSX), not
     * JSON, so the raw blob is returned for the caller to save.
     */
    async exportDataset(
        dataset: string,
        from: string,
        to: string,
        format = 'csv'
    ): Promise<Blob> {
        const res = await analyticsApi.apiV1AnalyticsExportGetRaw({
            dataset,
            from: new Date(from),
            to: new Date(to),
            format,
        });
        return res.raw.blob();
    }
}
