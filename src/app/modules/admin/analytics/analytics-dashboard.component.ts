import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    input,
    signal,
} from '@angular/core';
import {
    AbstractControl,
    FormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.types';
import { DateTime } from 'luxon';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { Subject, takeUntil } from 'rxjs';
import { AdminService } from '../admin.service';
import { AdminBatchCostOverview } from '../admin.types';
import {
    CHART_COLORS,
    CHART_STATUS_COLORS,
    DUAL_AREA_COLORS,
    areaChart,
    barChart,
    donutChart,
    dualAreaChart,
    heatmapChart,
} from '../shared/chart-theme';
import {
    AnalyticsPoint,
    AnalyticsService,
    HeatmapSeries,
    OrderMetricsResult,
} from './analytics.service';

/** Optional Luxon day from the Material datepicker. */
function validDate(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (value == null || value === '') {
        return { required: true };
    }
    return DateTime.isDateTime(value) && value.isValid
        ? null
        : { invalidDate: true };
}

function toIsoDate(value: DateTime | null | undefined): string | null {
    return value && DateTime.isDateTime(value) && value.isValid
        ? value.toISODate()
        : null;
}

/** Overview KPI tile with Fuse-style accent classes. */
interface OverviewTile {
    titleKey: string;
    value: string;
    valueClass: string;
}

/** Quick-link cards under the analytics panels. */
interface DashboardCard {
    icon: string;
    link: string;
    titleKey: string;
    descriptionKey: string;
}

interface OperationalInsight {
    key: string;
    icon: string;
    titleKey: string;
    value: string;
    detailKey: string;
    detailParams?: Record<string, string | number>;
    accentClass: string;
}

/**
 * The arrow-and-percentage Fuse prints beside each figure of its
 * "Visitors vs. Page Views" card. The text is unsigned — `up` carries the
 * direction — and `good` is the colour, which is not the same thing: fewer
 * loss-making sessions is a down arrow and still green.
 */
interface CostDelta {
    text: string;
    up: boolean;
    good: boolean;
}

/** One of the three figures above the cost chart. */
interface CostStat {
    key: string;
    labelKey: string;
    helpKey: string;
    value: string;
    valueClass: string;
    delta: CostDelta | null;
}

function deltaOf(
    value: number | null,
    format: (magnitude: number) => string,
    higherIsBetter: boolean
): CostDelta | null {
    // Exactly zero draws nothing: an arrow that points at "no change" is worse
    // than the blank space it fills.
    if (value === null || value === 0) {
        return null;
    }
    const up = value > 0;
    return { text: format(Math.abs(value)), up, good: up === higherIsBetter };
}

/** The money read off a run of settled sessions — the whole plot, or half of it. */
interface CostWindow {
    sessions: number;
    orderTotal: number;
    purchaseTotal: number;
    margin: number;
    /** Undefined rather than 0 with no revenue: a ratio over nothing is unanswerable. */
    marginRatio: number | null;
    lossMaking: number;
}

function costWindowOf(batches: AdminBatchCostOverview[]): CostWindow {
    const orderTotal = batches.reduce(
        (sum, batch) => sum + batch.restaurantOrderTotal,
        0
    );
    const purchaseTotal = batches.reduce(
        (sum, batch) => sum + batch.actualPurchaseTotal,
        0
    );
    const margin = orderTotal - purchaseTotal;
    return {
        sessions: batches.length,
        orderTotal,
        purchaseTotal,
        margin,
        marginRatio: orderTotal > 0 ? (margin / orderTotal) * 100 : null,
        // Sessions the chợ cost more than the restaurants were charged.
        lossMaking: batches.filter(
            (batch) => batch.actualPurchaseTotal > batch.restaurantOrderTotal
        ).length,
    };
}

const KPI_ACCENTS = [
    'text-blue-500',
    'text-red-500',
    'text-amber-500',
    'text-green-500',
] as const;

/** Empty metrics, used when the orders read fails so the panel still renders. */
const NO_ORDER_METRICS: OrderMetricsResult = {
    points: [],
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
};

/** Longest list a category chart plots — beyond this the labels stop being readable. */
const MAX_CATEGORIES = 12;

/**
 * Phiên chợ plotted on the cost chart. One request per batch resolves its
 * overview, so this caps the fan-out as well as the chart's width.
 */
const COST_TREND_BATCHES = 20;

/**
 * Settled sessions each half of the window needs before the halves are worth
 * comparing. Below this a single unusual chợ *is* the trend.
 */
const COST_DELTA_MIN_SESSIONS = 2;

/** Formats a raw overview value with locale thousands separators when numeric. */
function formatKpiValue(value: unknown, lang: string): string {
    const numeric =
        typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(numeric) && String(value).trim() !== ''
        ? numeric.toLocaleString(lang)
        : String(value);
}

function formatCurrency(value: number, lang: string): string {
    return new Intl.NumberFormat(lang, {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(value);
}

function total(points: AnalyticsPoint[]): number {
    return points.reduce((sum, point) => sum + point.value, 0);
}

function maximum(points: AnalyticsPoint[]): AnalyticsPoint | null {
    return points.reduce<AnalyticsPoint | null>(
        (current, point) =>
            current === null || point.value > current.value ? point : current,
        null
    );
}

/** The `n` largest points, biggest first — for the "top hubs / listings" charts. */
function topBy(points: AnalyticsPoint[], count: number): AnalyticsPoint[] {
    return [...points].sort((a, b) => b.value - a.value).slice(0, count);
}

/**
 * Admin ▸ Dashboard ▸ Phân tích — the reporting panel of the console's
 * dashboard, driven by `/analytics/*` over a date range.
 *
 * The panel is built from the Fuse analytics/project dashboards: KPI row,
 * derived insights, then a grid of charts. Every chart reads a live endpoint
 * and each one is fetched independently — a single failing series leaves the
 * rest of the panel intact rather than blanking the page, which matters here
 * because the analytics endpoints are the console's least stable.
 *
 * Rendered inside the dashboard's tab bar ({@link embedded}); it keeps its own
 * route-level header when opened on its own.
 */
@Component({
    selector: 'admin-analytics-panel',
    templateUrl: './analytics-dashboard.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        MatButtonModule,
        MatDatepickerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatTooltipModule,
        NgApexchartsModule,
        ReactiveFormsModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class AdminAnalyticsPanelComponent implements OnInit, OnDestroy {
    private readonly _analytics = inject(AnalyticsService);
    private readonly _admin = inject(AdminService);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _userService = inject(UserService);
    private readonly _unsubscribeAll = new Subject<void>();

    /**
     * True when the dashboard's tab bar is already showing the greeting and
     * the section name — the panel then drops its own page header and renders
     * from the range picker down.
     */
    readonly embedded = input(false);

    readonly loading = signal(false);
    readonly user = signal<User | null>(null);
    readonly tiles = signal<OverviewTile[]>([]);
    readonly orderTrend = signal<AnalyticsPoint[]>([]);
    readonly procurementMetrics = signal<AnalyticsPoint[]>([]);
    readonly hubThroughput = signal<AnalyticsPoint[]>([]);
    readonly deliveryPerformance = signal<AnalyticsPoint[]>([]);
    readonly demandDistribution = signal<AnalyticsPoint[]>([]);
    readonly demandHeatmap = signal<HeatmapSeries[]>([]);
    readonly priceTrends = signal<AnalyticsPoint[]>([]);

    /**
     * Cost overviews for the recent phiên chợ, oldest first. Not part of
     * `/analytics/*` — this reads the procurement overview per batch, so it is
     * the one series on the panel that does not follow the date range.
     */
    readonly costTrend = signal<AdminBatchCostOverview[]>([]);

    // ---- Charts -----------------------------------------------------------
    //
    // Each is a `computed`, so a reload re-derives it from the signal it reads
    // and `ng-apexcharts` diffs the options itself. Labels are translated here
    // rather than in the template: Apex takes plain strings, not pipes.

    /** Orders per day across the range — the panel's headline series. */
    readonly ordersChart = computed<ApexOptions>(() =>
        areaChart(this.orderTrend(), {
            name: this._t('admin.analytics.orderMetrics'),
            format: (value) => this._number(value),
        })
    );

    /** Orders by hour of day — where the ordering day actually peaks. */
    readonly demandHourChart = computed<ApexOptions>(() =>
        barChart(this.demandDistribution(), {
            name: this._t('admin.analytics.demandDistribution'),
            format: (value) => this._number(value),
            colors: [CHART_COLORS[4]],
        })
    );

    /** Day × hour demand grid. */
    readonly demandHeatmapChart = computed<ApexOptions>(() =>
        heatmapChart(this.demandHeatmap())
    );

    /** Procurement batches by lifecycle stage. */
    readonly procurementChart = computed<ApexOptions>(() =>
        donutChart(
            this.procurementMetrics().map((point) => ({
                label: this._apiLabel(
                    point.label,
                    'admin.analytics.procurementStatus'
                ),
                value: point.value,
            })),
            { format: (value) => this._number(value) }
        )
    );

    /**
     * Delivery outcomes. Fixed semantic colours rather than the palette — green
     * for on-time and red for failed is the whole point of the chart, and a
     * rotating palette would put them anywhere.
     */
    readonly deliveryChart = computed<ApexOptions>(() =>
        donutChart(
            this.deliveryPerformance().map((point) => ({
                label: this._apiLabel(
                    point.label,
                    'admin.analytics.deliveryStatus'
                ),
                value: point.value,
            })),
            {
                colors: [
                    CHART_STATUS_COLORS.good,
                    CHART_STATUS_COLORS.warn,
                    CHART_STATUS_COLORS.bad,
                ],
                format: (value) => this._number(value),
            }
        )
    );

    /** Kg in + out per hub, busiest first. Horizontal: hub names are long. */
    readonly hubChart = computed<ApexOptions>(() =>
        barChart(topBy(this.hubThroughput(), MAX_CATEGORIES), {
            name: this._t('admin.analytics.hubThroughput'),
            horizontal: true,
            format: (value) => `${this._number(value)} kg`,
            colors: [CHART_COLORS[1]],
            height: 360,
        })
    );

    /** Average price per tracked listing. Horizontal for the same reason. */
    readonly priceChart = computed<ApexOptions>(() =>
        barChart(topBy(this.priceTrends(), MAX_CATEGORIES), {
            name: this._t('admin.analytics.priceTrends'),
            horizontal: true,
            format: (value) => this._currency(value),
            colors: [CHART_COLORS[2]],
            height: 360,
        })
    );

    // ---- Purchase cost vs. what restaurants were charged ------------------
    //
    // `feat(procurement): expose purchase cost totals` put both totals on
    // `GET /procurement/batches/{id}/overview`. Plotted as Fuse's two-series
    // area card: the upper band is revenue, the lower is what the chợ actually
    // cost, and the gap between them is the session's margin.

    /**
     * The batches whose margin is real — every line bought and priced. These
     * are what the chart plots and what the figures are computed from.
     */
    readonly settledCostTrend = computed(() =>
        this.costTrend().filter((batch) => batch.settlement === 'settled')
    );

    /**
     * The batches still being shopped, newest first.
     *
     * Listed rather than dropped. Their `restaurantOrderTotal` is already final
     * while `actualPurchaseTotal` only counts the lines bought so far, so the
     * gap between the two is mostly *unrecorded cost* — which is why they stay
     * out of the totals above and are shown here with their progress instead,
     * as "chưa xong" rather than as an enormous margin.
     */
    readonly inProgressCostTrend = computed(() =>
        this.costTrend()
            .filter((batch) => batch.settlement === 'inProgress')
            .sort((a, b) =>
                String(b.batchDate ?? '').localeCompare(
                    String(a.batchDate ?? '')
                )
            )
    );

    /**
     * The chart's two colours. The plot hides its own legend (Fuse's card has
     * none), so the card labels the bands itself with these.
     */
    readonly bandColors = DUAL_AREA_COLORS;

    readonly costChart = computed<ApexOptions>(() => {
        const batches = this.settledCostTrend();
        return dualAreaChart(
            // Date only. The x labels sit *inside* the plot here (Fuse pulls
            // them up with `offsetY: -20`), so the market name that the
            // in-progress list shows would run into the curves.
            batches.map((batch) => this._batchDay(batch)),
            {
                name: this._t('admin.analytics.cost.orderTotal'),
                data: batches.map((batch) => batch.restaurantOrderTotal),
            },
            {
                name: this._t('admin.analytics.cost.purchaseTotal'),
                data: batches.map((batch) => batch.actualPurchaseTotal),
            },
            { format: (value) => this._currency(value) }
        );
    });

    /**
     * Revenue, cost, margin and the loss-making sessions over the plot, each
     * with the change against the earlier half of the same window.
     *
     * The deltas are the window comparing itself. Fuse hard-codes its three
     * percentages; there is no endpoint here that would return a previous
     * period, so the older half of the sessions we already fetched is the
     * baseline for the newer half. That is honest as long as it is labelled,
     * and it needs {@link COST_DELTA_MIN_SESSIONS} a side to be worth drawing.
     */
    readonly costSummary = computed(() => {
        const batches = this.settledCostTrend();
        const all = this.costTrend();
        const overall = costWindowOf(batches);

        const mid = Math.floor(batches.length / 2);
        const earlier = costWindowOf(batches.slice(0, mid));
        const recent = costWindowOf(batches.slice(mid));
        const comparable =
            earlier.sessions >= COST_DELTA_MIN_SESSIONS &&
            recent.sessions >= COST_DELTA_MIN_SESSIONS;

        return {
            ...overall,
            // Counted so the card can say what it left out. A three-point chart
            // with no explanation reads as "there were only three sessions".
            inProgress: all.filter((batch) => batch.settlement === 'inProgress')
                .length,
            cancelled: all.filter((batch) => batch.settlement === 'cancelled')
                .length,
            // Three units, so three fields: a percent change on the money,
            // percentage points on the ratio, and plain sessions on the count.
            marginDelta:
                comparable && earlier.margin !== 0
                    ? ((recent.margin - earlier.margin) /
                          Math.abs(earlier.margin)) *
                      100
                    : null,
            ratioDelta:
                comparable &&
                earlier.marginRatio !== null &&
                recent.marginRatio !== null
                    ? recent.marginRatio - earlier.marginRatio
                    : null,
            lossDelta: comparable
                ? recent.lossMaking - earlier.lossMaking
                : null,
        };
    });

    /** The three figures above the chart, in Fuse's order. */
    readonly costStats = computed<CostStat[]>(() => {
        const summary = this.costSummary();
        return [
            {
                key: 'margin',
                labelKey: 'admin.analytics.cost.margin',
                helpKey: 'admin.analytics.cost.marginHelp',
                value: this._currency(summary.margin),
                valueClass: summary.margin < 0 ? 'text-red-500' : '',
                delta: deltaOf(
                    summary.marginDelta,
                    (magnitude) => this.percent(magnitude),
                    true
                ),
            },
            {
                key: 'ratio',
                labelKey: 'admin.analytics.cost.marginRatio',
                helpKey: 'admin.analytics.cost.marginRatioHelp',
                value: this.percent(summary.marginRatio),
                valueClass: '',
                delta: deltaOf(
                    summary.ratioDelta,
                    (magnitude) =>
                        this._t('admin.analytics.cost.points', {
                            value: this._number(
                                Math.round(magnitude * 10) / 10
                            ),
                        }),
                    true
                ),
            },
            {
                key: 'loss',
                labelKey: 'admin.analytics.cost.lossMaking',
                helpKey: 'admin.analytics.cost.lossMakingHelp',
                value: this._number(summary.lossMaking),
                valueClass: summary.lossMaking > 0 ? 'text-red-500' : '',
                // Down is the good direction here: fewer sessions underwater.
                delta: deltaOf(
                    summary.lossDelta,
                    (magnitude) => this._number(magnitude),
                    false
                ),
            },
        ];
    });

    readonly operationalInsights = computed<OperationalInsight[]>(() => {
        const lang = this._transloco.getActiveLang();
        const busiestHub = maximum(this.hubThroughput());
        const peakDemand = maximum(this.demandDistribution());
        const deliveries = this.deliveryPerformance();
        const deliveryTotal = total(deliveries);
        const onTime =
            deliveries.find((point) => point.label === 'onTime')?.value ?? 0;
        const procurement = this.procurementMetrics();
        const procurementTotal = total(procurement);
        const completed =
            procurement.find(
                (point) => point.label.toLowerCase() === 'completed'
            )?.value ?? 0;

        return [
            {
                key: 'busiest-hub',
                icon: 'heroicons_outline:building-office-2',
                titleKey: 'admin.analytics.insights.busiestHub',
                value: busiestHub?.label || '—',
                detailKey: busiestHub
                    ? 'admin.analytics.insights.throughputDetail'
                    : 'admin.analytics.noData',
                detailParams: busiestHub
                    ? {
                          value: formatKpiValue(busiestHub.value, lang),
                      }
                    : undefined,
                accentClass:
                    'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200',
            },
            {
                key: 'peak-demand',
                icon: 'heroicons_outline:clock',
                titleKey: 'admin.analytics.insights.peakDemand',
                value: peakDemand?.label || '—',
                detailKey: peakDemand
                    ? 'admin.analytics.insights.ordersDetail'
                    : 'admin.analytics.noData',
                detailParams: peakDemand
                    ? {
                          value: formatKpiValue(peakDemand.value, lang),
                      }
                    : undefined,
                accentClass:
                    'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-200',
            },
            {
                key: 'on-time-rate',
                icon: 'heroicons_outline:truck',
                titleKey: 'admin.analytics.insights.onTimeRate',
                value: deliveryTotal
                    ? Math.round((onTime / deliveryTotal) * 100).toString() +
                      '%'
                    : '—',
                detailKey: deliveryTotal
                    ? 'admin.analytics.insights.deliveryDetail'
                    : 'admin.analytics.noData',
                detailParams: deliveryTotal
                    ? {
                          onTime: formatKpiValue(onTime, lang),
                          total: formatKpiValue(deliveryTotal, lang),
                      }
                    : undefined,
                accentClass:
                    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
            },
            {
                key: 'procurement-completion',
                icon: 'heroicons_outline:shopping-cart',
                titleKey: 'admin.analytics.insights.procurementCompletion',
                value: procurementTotal
                    ? Math.round(
                          (completed / procurementTotal) * 100
                      ).toString() + '%'
                    : '—',
                detailKey: procurementTotal
                    ? 'admin.analytics.insights.procurementDetail'
                    : 'admin.analytics.noData',
                detailParams: procurementTotal
                    ? {
                          completed: formatKpiValue(completed, lang),
                          total: formatKpiValue(procurementTotal, lang),
                      }
                    : undefined,
                accentClass:
                    'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
            },
        ];
    });

    readonly rangeForm = this._formBuilder.group({
        from: this._formBuilder.control<DateTime | null>(
            DateTime.now().minus({ days: 29 }).startOf('day'),
            { validators: [validDate] }
        ),
        to: this._formBuilder.control<DateTime | null>(
            DateTime.now().startOf('day'),
            { validators: [validDate] }
        ),
    });

    readonly displayName = computed(() => {
        const u = this.user();
        return u?.fullName || u?.name || u?.email || '';
    });

    readonly cards: DashboardCard[] = [
        {
            icon: 'heroicons_outline:users',
            link: '/admin/users',
            titleKey: 'admin.dashboard.users.title',
            descriptionKey: 'admin.dashboard.users.description',
        },
        {
            icon: 'heroicons_outline:building-storefront',
            link: '/admin/users?role=restaurant',
            titleKey: 'admin.dashboard.restaurants.title',
            descriptionKey: 'admin.dashboard.restaurants.description',
        },
        {
            icon: 'heroicons_outline:rectangle-group',
            link: '/admin/order-groups',
            titleKey: 'admin.dashboard.orderGroups.title',
            descriptionKey: 'admin.dashboard.orderGroups.description',
        },
    ];

    ngOnInit(): void {
        this._userService.user$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user) => this.user.set(user));

        this.reload();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    reload(): void {
        if (this.rangeForm.invalid) {
            this.rangeForm.markAllAsTouched();
            return;
        }
        const from = toIsoDate(this.rangeForm.controls.from.value);
        const to = toIsoDate(this.rangeForm.controls.to.value);
        if (!from || !to) {
            return;
        }
        this.loading.set(true);

        // Each series fails on its own: these endpoints answer independently,
        // and one 500 should cost one card, not the panel.
        Promise.all([
            this._analytics
                .getOrderMetrics(from, to)
                .catch(() => NO_ORDER_METRICS),
            this._analytics.getProcurementMetrics(from, to).catch(() => []),
            this._analytics.getHubThroughput(from, to).catch(() => []),
            this._analytics.getDeliveryPerformance(from, to).catch(() => []),
            this._analytics.getDemandTimeDistribution(from, to).catch(() => []),
            this._analytics.getDemandHeatmap(from, to).catch(() => []),
            this._analytics.getPriceTrends(from, to).catch(() => []),
            // Procurement, not analytics: keyed by batch rather than by date,
            // so it shows the last N phiên chợ regardless of the range above.
            this._admin
                .getPurchaseCostTrend(COST_TREND_BATCHES)
                .catch((): AdminBatchCostOverview[] => []),
        ])
            .then(
                ([
                    orders,
                    procurement,
                    hubs,
                    deliveries,
                    demand,
                    heatmap,
                    prices,
                    costs,
                ]) => {
                    const lang = this._transloco.getActiveLang();
                    this.tiles.set([
                        {
                            titleKey: 'admin.analytics.kpis.ordersInRange',
                            value: formatKpiValue(orders.totalOrders, lang),
                            valueClass: KPI_ACCENTS[0],
                        },
                        {
                            titleKey: 'admin.analytics.kpis.revenueInRange',
                            value: formatCurrency(orders.totalRevenue, lang),
                            valueClass: KPI_ACCENTS[1],
                        },
                        {
                            titleKey: 'admin.analytics.kpis.pendingInRange',
                            value: formatKpiValue(orders.pendingOrders, lang),
                            valueClass: KPI_ACCENTS[2],
                        },
                        {
                            titleKey: 'admin.analytics.kpis.cancelledInRange',
                            value: formatKpiValue(orders.cancelledOrders, lang),
                            valueClass: KPI_ACCENTS[3],
                        },
                    ]);
                    this.orderTrend.set(orders.points);
                    this.procurementMetrics.set(procurement);
                    this.hubThroughput.set(hubs);
                    this.deliveryPerformance.set(deliveries);
                    this.demandDistribution.set(demand);
                    this.demandHeatmap.set(heatmap);
                    this.priceTrends.set(prices);
                    this.costTrend.set(costs);
                }
            )
            .finally(() => this.loading.set(false));
    }

    /** Money, for the figures the template prints beside the cost chart. */
    money(value: number): string {
        return this._currency(value);
    }

    /** The x-axis label for a batch, reused by the in-progress list. */
    batchLabel(batch: AdminBatchCostOverview): string {
        return this._batchLabel(batch);
    }

    /** How far through its shopping a batch is, as a whole percent. */
    purchaseProgress(batch: AdminBatchCostOverview): number {
        return batch.itemCount > 0
            ? Math.round((batch.itemsPurchased / batch.itemCount) * 100)
            : 0;
    }

    /** Percent to one decimal, or a dash when the ratio is unanswerable. */
    percent(value: number | null): string {
        return value === null
            ? '—'
            : `${value.toLocaleString(this._transloco.getActiveLang(), {
                  maximumFractionDigits: 1,
              })}%`;
    }

    /**
     * A batch's x-axis label: its service date, falling back to the batch code
     * and then to a short id. Two batches can share a date (one per chợ), so
     * the market name is appended when there is one.
     */
    private _batchLabel(batch: AdminBatchCostOverview): string {
        const base = this._batchDay(batch);
        return batch.marketName ? `${base} · ${batch.marketName}` : base;
    }

    /**
     * Just the service date, for the x-axis. `batchDate` is non-nullable on the
     * DTO, so the code and id are only there for a body we could not read.
     */
    private _batchDay(batch: AdminBatchCostOverview): string {
        const day = batch.batchDate
            ? DateTime.fromISO(batch.batchDate).toFormat('dd/MM')
            : null;
        return day ?? batch.batchCode ?? batch.batchId.slice(0, 8);
    }

    private _t(key: string, params?: Record<string, unknown>): string {
        return this._transloco.translate(key, params);
    }

    /**
     * Translates a backend token through `<prefix>.<value>`, falling back to the
     * token itself. Same rule as {@link ApiLabelPipe}, applied here because a
     * chart's labels are built in TypeScript, not in the template.
     */
    private _apiLabel(value: string, prefix: string): string {
        const key = `${prefix}.${value.trim().toLowerCase()}`;
        const label = this._transloco.translate(key);
        return label && label !== key ? label : value;
    }

    private _number(value: number): string {
        return value.toLocaleString(this._transloco.getActiveLang());
    }

    private _currency(value: number): string {
        return formatCurrency(value, this._transloco.getActiveLang());
    }
}
