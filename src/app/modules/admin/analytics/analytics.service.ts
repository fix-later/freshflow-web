import { Injectable } from '@angular/core';
import { extractList, parseJson, unwrapData } from 'app/core/api/envelope';
import { analyticsApi, marketsApi } from 'contract';

/**
 * A `{ label, value }` pair extracted from any of the untyped analytics
 * series. The backend names these keys inconsistently across endpoints, so
 * {@link toSeries} probes a set of candidates rather than assuming one shape.
 */
export interface AnalyticsPoint {
    label: string;
    value: number;
}

export interface OrderMetricsResult {
    points: AnalyticsPoint[];
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    cancelledOrders: number;
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
    'hourOfDay',
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
function toSeries(
    body: unknown,
    labelKeys = LABEL_KEYS,
    valueKeys = VALUE_KEYS
): AnalyticsPoint[] {
    return extractList<Record<string, unknown>>(body)
        .map((row) => ({
            label: pick(row, labelKeys),
            value: pickNumber(row, valueKeys),
        }))
        .filter((point) => point.label !== '' || point.value !== 0);
}

function dataRecord(body: unknown): Record<string, unknown> {
    return unwrapData<Record<string, unknown>>(body) ?? {};
}

function statusPoints(value: unknown): AnalyticsPoint[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return [];
    }
    return Object.entries(value as Record<string, unknown>)
        .map(([label, count]) => ({
            label,
            value: Number(count),
        }))
        .filter((point) => Number.isFinite(point.value));
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
    private _priceTrendProductIds: string[] | null = null;

    async getOrderMetrics(
        from: string,
        to: string,
        groupBy = 'day'
    ): Promise<OrderMetricsResult> {
        const res = await analyticsApi.apiV1AnalyticsOrderMetricsGetRaw({
            from: new Date(from),
            to: new Date(to),
            groupBy,
        });
        const data = dataRecord(await parseJson(res.raw));
        const summary =
            data['summary'] &&
            typeof data['summary'] === 'object' &&
            !Array.isArray(data['summary'])
                ? (data['summary'] as Record<string, unknown>)
                : {};
        const statusCounts =
            summary['statusCounts'] &&
            typeof summary['statusCounts'] === 'object' &&
            !Array.isArray(summary['statusCounts'])
                ? (summary['statusCounts'] as Record<string, unknown>)
                : {};

        return {
            points: toSeries(data['buckets'], ['date'], ['orderCount']),
            totalOrders: pickNumber(summary, ['totalOrders']),
            totalRevenue: pickNumber(summary, ['totalRevenueVND']),
            pendingOrders:
                pickNumber(statusCounts, ['Draft']) +
                pickNumber(statusCounts, ['Confirmed']),
            cancelledOrders: pickNumber(summary, ['cancelledCount']),
        };
    }

    async getProcurementMetrics(
        from: string,
        to: string
    ): Promise<AnalyticsPoint[]> {
        const res = await analyticsApi.apiV1AnalyticsProcurementMetricsGetRaw({
            from: new Date(from),
            to: new Date(to),
        });
        const data = dataRecord(await parseJson(res.raw));
        return statusPoints(data['statusCounts']);
    }

    async getHubThroughput(
        from: string,
        to: string
    ): Promise<AnalyticsPoint[]> {
        const res = await analyticsApi.apiV1AnalyticsHubThroughputGetRaw({
            from: new Date(from),
            to: new Date(to),
        });
        const data = dataRecord(await parseJson(res.raw));
        const buckets = Array.isArray(data['buckets'])
            ? (data['buckets'] as Record<string, unknown>[])
            : [];
        const byHub = new Map<string, number>();
        for (const bucket of buckets) {
            const hubName = pick(bucket, ['hubName', 'hubId']) || '—';
            const throughput =
                pickNumber(bucket, ['inboundKg']) +
                pickNumber(bucket, ['outboundKg']);
            byHub.set(hubName, (byHub.get(hubName) ?? 0) + throughput);
        }
        return [...byHub].map(([label, value]) => ({ label, value }));
    }

    async getDeliveryPerformance(
        from: string,
        to: string
    ): Promise<AnalyticsPoint[]> {
        const res = await analyticsApi.apiV1AnalyticsDeliveryPerformanceGetRaw({
            from: new Date(from),
            to: new Date(to),
        });
        const data = dataRecord(await parseJson(res.raw));
        const totalDeliveries = pickNumber(data, ['totalDeliveries']);
        if (totalDeliveries === 0) return [];
        return [
            {
                label: 'onTime',
                value: pickNumber(data, ['onTimeCount']),
            },
            {
                label: 'late',
                value: pickNumber(data, ['lateCount']),
            },
            {
                label: 'failed',
                value: pickNumber(data, ['failedCount']),
            },
        ];
    }

    async getPriceTrends(
        from: string,
        to: string,
        interval = 'daily'
    ): Promise<AnalyticsPoint[]> {
        const marketProductId = await this._getPriceTrendProductIds();
        if (!marketProductId.length) {
            return [];
        }
        const res = await analyticsApi.apiV1AnalyticsPriceTrendsGetRaw({
            from: new Date(from),
            to: new Date(to),
            marketProductId,
            interval,
        });
        const data = dataRecord(await parseJson(res.raw));
        const series = Array.isArray(data['series'])
            ? (data['series'] as Record<string, unknown>[])
            : [];
        return series
            .map((row) => {
                const summary =
                    row['summary'] &&
                    typeof row['summary'] === 'object' &&
                    !Array.isArray(row['summary'])
                        ? (row['summary'] as Record<string, unknown>)
                        : {};
                return {
                    label:
                        [row['productName'], row['marketName']]
                            .filter(Boolean)
                            .map(String)
                            .join(' · ') || '—',
                    value: pickNumber(summary, ['avgPrice']),
                };
            })
            .filter((point) => point.value > 0);
    }

    /**
     * Price analytics requires 1–10 listing ids. Pick up to ten active
     * listings from active markets and cache them for later range changes;
     * calling the endpoint without these ids is rejected by the backend.
     */
    private async _getPriceTrendProductIds(): Promise<string[]> {
        if (this._priceTrendProductIds !== null) {
            return this._priceTrendProductIds;
        }

        const marketsResponse = await marketsApi.apiV1MarketsGetRaw({
            activeOnly: true,
        });
        const markets = extractList<Record<string, unknown>>(
            await parseJson(marketsResponse.raw)
        );
        const ids: string[] = [];

        for (const market of markets) {
            if (ids.length >= 10) {
                break;
            }
            const marketId = pick(market, ['marketId', 'id']);
            if (!marketId) {
                continue;
            }
            const productsResponse =
                await marketsApi.apiV1MarketsMarketIdProductsGetRaw({
                    marketId,
                    pageSize: 10 - ids.length,
                });
            const products = extractList<Record<string, unknown>>(
                await parseJson(productsResponse.raw)
            );
            for (const product of products) {
                if (product['isActive'] === false) {
                    continue;
                }
                const id = pick(product, ['marketProductId', 'id']);
                if (id && !ids.includes(id)) {
                    ids.push(id);
                }
                if (ids.length >= 10) {
                    break;
                }
            }
        }

        this._priceTrendProductIds = ids;
        return ids;
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
        const rows = extractList<Record<string, unknown>>(
            await parseJson(res.raw)
        );
        const byHour = new Map<number, number>();
        for (const row of rows) {
            const hour = pickNumber(row, ['hourOfDay', 'hour']);
            const orderCount = pickNumber(row, ['orderCount', 'count']);
            byHour.set(hour, (byHour.get(hour) ?? 0) + orderCount);
        }
        return [...byHour]
            .sort(([left], [right]) => left - right)
            .map(([hour, value]) => ({
                label: hour.toString().padStart(2, '0') + ':00',
                value,
            }));
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
