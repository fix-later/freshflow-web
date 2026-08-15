/**
 * Shared ApexCharts theming for the admin console's dashboard panels.
 *
 * Every chart on the dashboard is built from these helpers rather than a
 * hand-written `ApexOptions` literal. Three reasons:
 *
 *  - **One look.** Fuse's chart styling is ~40 lines of grid/axis/tooltip
 *    options repeated per chart. Copied fifteen times it drifts, and half the
 *    charts end up with a different grid colour or an axis that ignores the
 *    theme.
 *  - **Dark mode.** The colours below are the Fuse CSS custom properties
 *    (`--fuse-border`, `--fuse-text-secondary`), so a chart follows the scheme
 *    switch without re-rendering. A hard-coded hex would not.
 *  - **Empty data.** Every panel reads a live endpoint that can legitimately
 *    answer nothing, so each helper tolerates an empty series instead of the
 *    caller guarding at fifteen call sites.
 *
 * The palette is the Fuse dashboard demo's, kept in one order so the same
 * category keeps the same colour across panels.
 */
import { ApexOptions } from 'ng-apexcharts';

/** Categorical palette, in the order Fuse's dashboards use it. */
export const CHART_COLORS = [
    '#818CF8', // indigo
    '#34D399', // emerald
    '#FBBF24', // amber
    '#F87171', // red
    '#22D3EE', // cyan
    '#A78BFA', // violet
    '#FB923C', // orange
    '#4ADE80', // green
] as const;

/** Semantic colours for the fixed outcome charts (on-time / late / failed …). */
export const CHART_STATUS_COLORS = {
    good: '#34D399',
    warn: '#FBBF24',
    bad: '#F87171',
    neutral: '#94A3B8',
} as const;

/** Axis/grid/tooltip options every cartesian chart shares. */
const CARTESIAN_FRAME = {
    grid: { borderColor: 'var(--fuse-border)', strokeDashArray: 4 },
    tooltip: { followCursor: true, theme: 'dark' },
} satisfies Partial<ApexOptions>;

/** The `chart` block every chart shares — inherits the app's font and colour. */
function chartBlock(
    type: string,
    height: number
): NonNullable<ApexOptions['chart']> {
    return {
        fontFamily: 'inherit',
        foreColor: 'inherit',
        height,
        type: type as never,
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: true },
    };
}

function xAxisLabels(categories: string[], rotate = 0): ApexOptions['xaxis'] {
    return {
        categories,
        axisBorder: { show: false },
        axisTicks: { color: 'var(--fuse-border)' },
        labels: {
            rotate,
            rotateAlways: rotate !== 0,
            hideOverlappingLabels: true,
            trim: true,
            style: { colors: 'var(--fuse-text-secondary)' },
        },
        tooltip: { enabled: false },
    };
}

function yAxisLabels(
    formatter?: (value: number) => string
): ApexOptions['yaxis'] {
    return {
        labels: {
            offsetX: -8,
            formatter: formatter as never,
            style: { colors: 'var(--fuse-text-secondary)' },
        },
    };
}

/** A `{ label, value }` pair — the shape every analytics series normalises to. */
export interface ChartPoint {
    label: string;
    value: number;
}

/** Options shared by the four builders below. */
interface ChartOptions {
    /** Series name, shown in the tooltip. */
    name?: string;
    /** Formats a value for the y-axis and the tooltip (money, kg, …). */
    format?: (value: number) => string;
    /** Overrides the palette; useful for the fixed-outcome charts. */
    colors?: string[];
    height?: number;
    /** Degrees to rotate x labels by — for long category names. */
    rotateLabels?: number;
}

/**
 * A time/category series as a filled area — the shape for "how did this move
 * across the period" (orders per day, price per day).
 */
export function areaChart(
    points: ChartPoint[],
    options: ChartOptions = {}
): ApexOptions {
    const color = options.colors?.[0] ?? CHART_COLORS[0];
    return {
        ...CARTESIAN_FRAME,
        chart: chartBlock('area', options.height ?? 320),
        colors: [color],
        dataLabels: { enabled: false },
        fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 },
        },
        series: [
            { name: options.name ?? '', data: points.map((p) => p.value) },
        ],
        stroke: { curve: 'smooth', width: 2 },
        xaxis: xAxisLabels(
            points.map((p) => p.label),
            options.rotateLabels ?? 0
        ),
        yaxis: yAxisLabels(options.format),
    };
}

/**
 * The slate pair Fuse's "Visitors vs. Page Views" card is drawn in. Exported so
 * the card can dot its own labels in the same two colours — the chart itself
 * hides its legend (see {@link dualAreaChart}).
 */
export const DUAL_AREA_COLORS = ['#64748B', '#94A3B8'] as const;

/**
 * Two series over the same categories, as overlapping filled areas — Fuse's
 * "Visitors vs. Page Views" card, kept to its original styling: no grid, no
 * y-axis, no legend, x labels pulled up inside the plot, and the two slates
 * above. The band between the curves is the whole message.
 *
 * Two things follow from stripping the frame, and the caller has to supply
 * both — the card that uses this does:
 *  - **the numbers move to the header.** With `yaxis.show: false` the plot has
 *    no scale, so the absolute figures have to be printed above the chart the
 *    way Fuse prints its three. The tooltip still formats every point.
 *  - **the legend moves to the header too.** Two slates one shade apart cannot
 *    be told apart where the curves cross, so the header labels them with
 *    {@link DUAL_AREA_COLORS} dots.
 *
 * The x-axis stays categorical where Fuse uses `type: 'datetime'`: a point here
 * is one phiên chợ, not a day, and two chợ on the same date are two points.
 * `tickAmount` thins the labels to the same handful the original shows.
 */
export function dualAreaChart(
    categories: string[],
    first: { name: string; data: number[] },
    second: { name: string; data: number[] },
    options: Pick<ChartOptions, 'format' | 'height'> = {}
): ApexOptions {
    const colors = [...DUAL_AREA_COLORS];
    // Fuse pads its y-range by a flat ±250, which is meaningful for visitor
    // counts and invisible against millions of đồng. Same intent, scaled: a
    // tenth of the spread, so the curves never touch the top or bottom edge.
    const values = [...first.data, ...second.data];
    const lowest = values.length ? Math.min(...values) : 0;
    const highest = values.length ? Math.max(...values) : 0;
    const padding = (highest - lowest || highest || 1) * 0.1;
    return {
        chart: {
            ...chartBlock('area', options.height ?? 380),
            animations: { enabled: false },
        },
        colors,
        dataLabels: { enabled: false },
        fill: { colors, opacity: 0.5 },
        grid: { show: false, padding: { bottom: -40, left: 0, right: 0 } },
        legend: { show: false },
        series: [first, second],
        stroke: { curve: 'smooth', width: 2 },
        tooltip: {
            followCursor: true,
            theme: 'dark',
            y: { formatter: options.format as never },
        },
        xaxis: {
            categories,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                offsetY: -20,
                rotate: 0,
                hideOverlappingLabels: true,
                style: { colors: 'var(--fuse-text-secondary)' },
            },
            tickAmount: Math.min(categories.length, 4),
            tooltip: { enabled: false },
        },
        yaxis: {
            show: false,
            min: Math.max(0, lowest - padding),
            max: highest + padding,
            tickAmount: 5,
        },
    };
}

/**
 * A category series as bars. `horizontal` is for long category names (hub and
 * restaurant names), which a vertical axis would truncate to initials.
 */
export function barChart(
    points: ChartPoint[],
    options: ChartOptions & { horizontal?: boolean } = {}
): ApexOptions {
    return {
        ...CARTESIAN_FRAME,
        chart: chartBlock('bar', options.height ?? 320),
        colors: options.colors ? [...options.colors] : [CHART_COLORS[0]],
        dataLabels: { enabled: false },
        plotOptions: {
            bar: {
                horizontal: options.horizontal ?? false,
                borderRadius: 4,
                columnWidth: '55%',
                // Distributed colouring: one colour per category rather than
                // one per series. These charts all plot a single series, so
                // without it every bar is the same indigo.
                distributed: !!options.colors,
            },
        },
        legend: { show: false },
        series: [
            { name: options.name ?? '', data: points.map((p) => p.value) },
        ],
        xaxis: xAxisLabels(
            points.map((p) => p.label),
            options.rotateLabels ?? 0
        ),
        yaxis: yAxisLabels(options.format),
    };
}

/**
 * A parts-of-a-whole series as a donut — for the status breakdowns (claim
 * status, delivery outcome, invoice status), where the split matters more than
 * the absolute counts.
 */
export function donutChart(
    points: ChartPoint[],
    options: ChartOptions = {}
): ApexOptions {
    return {
        chart: chartBlock('donut', options.height ?? 320),
        colors: options.colors ? [...options.colors] : [...CHART_COLORS],
        labels: points.map((p) => p.label),
        legend: {
            position: 'bottom',
            labels: { colors: 'var(--fuse-text-secondary)' },
        },
        dataLabels: {
            enabled: true,
            formatter: (val) => `${Math.round(+val)}%`,
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '68%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            color: 'var(--fuse-text-secondary)',
                            formatter: () =>
                                (options.format ?? String)(
                                    points.reduce((sum, p) => sum + p.value, 0)
                                ),
                        },
                    },
                },
            },
        },
        series: points.map((p) => p.value),
        stroke: { width: 0 },
        tooltip: {
            theme: 'dark',
            y: { formatter: options.format as never },
        },
    };
}

/**
 * A radial gauge for a single 0–100 percentage — the portfolio's credit
 * utilisation, where one number against its ceiling is the whole story.
 */
export function radialChart(
    percent: number,
    label: string,
    color: string
): ApexOptions {
    return {
        chart: chartBlock('radialBar', 280),
        colors: [color],
        labels: [label],
        plotOptions: {
            radialBar: {
                hollow: { size: '62%' },
                track: { background: 'var(--fuse-border)' },
                dataLabels: {
                    name: {
                        offsetY: 22,
                        color: 'var(--fuse-text-secondary)',
                        fontSize: '13px',
                    },
                    value: {
                        offsetY: -18,
                        fontSize: '30px',
                        fontWeight: 700,
                        formatter: (val: number) => `${Math.round(val)}%`,
                    },
                },
            },
        },
        series: [Math.max(0, Math.min(100, Math.round(percent)))],
        stroke: { lineCap: 'round' },
    };
}

/**
 * A two-dimensional grid as a heatmap — the demand board, whose rows are days
 * and columns hours. Apex needs its own `{x, y}` series shape here, so this
 * takes the rows already in that form.
 */
export function heatmapChart(
    series: { name: string; data: { x: string; y: number }[] }[]
): ApexOptions {
    return {
        chart: { ...chartBlock('heatmap', 340) },
        colors: [CHART_COLORS[0]],
        dataLabels: { enabled: false },
        grid: { borderColor: 'var(--fuse-border)' },
        legend: { show: false },
        plotOptions: {
            heatmap: {
                radius: 4,
                enableShades: true,
                shadeIntensity: 0.6,
            },
        },
        series,
        stroke: { width: 1, colors: ['var(--fuse-bg-card)'] },
        tooltip: { theme: 'dark' },
        xaxis: {
            type: 'category',
            axisBorder: { show: false },
            axisTicks: { color: 'var(--fuse-border)' },
            labels: {
                hideOverlappingLabels: true,
                style: { colors: 'var(--fuse-text-secondary)' },
            },
        },
        yaxis: yAxisLabels(),
    };
}
