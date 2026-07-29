import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.types';
import { DateTime } from 'luxon';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { Subject, takeUntil } from 'rxjs';
import { AuditLogsComponent } from '../audit-logs/audit-logs.component';
import {
    AnalyticsActivity,
    AnalyticsPoint,
    AnalyticsService,
    HeatmapSeries,
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
    key: string;
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

const EXPORT_DATASETS = ['orders', 'procurement', 'deliveries'] as const;

const KPI_ACCENTS = [
    'text-blue-500',
    'text-red-500',
    'text-amber-500',
    'text-green-500',
] as const;

/** `overviewTotalOrders` → `Overview total orders`. */
function humanize(key: string): string {
    const spaced = key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim()
        .toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Formats a raw overview value with locale thousands separators when numeric. */
function formatKpiValue(value: unknown, lang: string): string {
    const numeric =
        typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(numeric) && String(value).trim() !== ''
        ? numeric.toLocaleString(lang)
        : String(value);
}

/**
 * Admin ▸ Dashboard (`/admin`) — Fuse project-dashboard shell with live
 * `/analytics/*` data, ApexCharts series, and quick links.
 */
@Component({
    selector: 'admin-analytics-dashboard',
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
        MatSnackBarModule,
        MatTabsModule,
        NgApexchartsModule,
        ReactiveFormsModule,
        RouterLink,
        TranslocoModule,
        AuditLogsComponent,
    ],
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
    private readonly _analytics = inject(AnalyticsService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _userService = inject(UserService);
    private readonly _unsubscribeAll = new Subject<void>();

    readonly loading = signal(false);
    readonly exporting = signal(false);
    readonly user = signal<User | null>(null);
    readonly tiles = signal<OverviewTile[]>([]);
    readonly orderMetrics = signal<AnalyticsPoint[]>([]);
    readonly procurementMetrics = signal<AnalyticsPoint[]>([]);
    readonly hubThroughput = signal<AnalyticsPoint[]>([]);
    readonly deliveryPerformance = signal<AnalyticsPoint[]>([]);
    readonly priceTrends = signal<AnalyticsPoint[]>([]);
    readonly demandDistribution = signal<AnalyticsPoint[]>([]);
    readonly demandHeatmap = signal<HeatmapSeries[]>([]);
    readonly activities = signal<AnalyticsActivity[]>([]);
    readonly selectedTab = signal(0);

    readonly chartOrders = signal<ApexOptions>({});
    readonly chartProcurement = signal<ApexOptions>({});
    readonly chartHubs = signal<ApexOptions>({});
    readonly chartDelivery = signal<ApexOptions>({});
    readonly chartPrices = signal<ApexOptions>({});
    readonly chartDemand = signal<ApexOptions>({});
    readonly chartHeatmap = signal<ApexOptions>({});

    readonly exportDatasets = [...EXPORT_DATASETS];

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
            link: '/admin/restaurants',
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
        // ApexCharts + `<base href>`: keep fill urls rooted (Fuse project pattern).
        (window as Window & { Apex?: unknown }).Apex = {
            chart: {
                events: {
                    mounted: (chart: { el: Element }): void => {
                        this._fixSvgFill(chart.el);
                    },
                    updated: (chart: { el: Element }): void => {
                        this._fixSvgFill(chart.el);
                    },
                },
            },
        };

        this._userService.user$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user) => this.user.set(user));

        this.reload();
    }

    setTab(index: number): void {
        this.selectedTab.set(index);
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

        Promise.all([
            this._analytics.getOverview().catch(() => ({})),
            this._analytics.getOrderMetrics(from, to).catch(() => []),
            this._analytics.getProcurementMetrics(from, to).catch(() => []),
            this._analytics.getHubThroughput(from, to).catch(() => []),
            this._analytics.getDeliveryPerformance(from, to).catch(() => []),
            this._analytics.getPriceTrends(from, to).catch(() => []),
            this._analytics.getDemandTimeDistribution(from, to).catch(() => []),
            this._analytics.getDemandHeatmap(from, to).catch(() => []),
            this._analytics.getRecentActivities().catch(() => []),
        ])
            .then(
                ([
                    overview,
                    orders,
                    procurement,
                    hubs,
                    deliveries,
                    prices,
                    demand,
                    heatmap,
                    activities,
                ]) => {
                    this.tiles.set(
                        Object.entries(overview)
                            .filter(
                                ([, value]) =>
                                    typeof value === 'number' ||
                                    typeof value === 'string'
                            )
                            .slice(0, 4)
                            .map(([key, value], index) => ({
                                key: humanize(key),
                                value: formatKpiValue(
                                    value,
                                    this._transloco.getActiveLang()
                                ),
                                valueClass:
                                    KPI_ACCENTS[index % KPI_ACCENTS.length],
                            }))
                    );
                    this.orderMetrics.set(orders);
                    this.procurementMetrics.set(procurement);
                    this.hubThroughput.set(hubs);
                    this.deliveryPerformance.set(deliveries);
                    this.priceTrends.set(prices);
                    this.demandDistribution.set(demand);
                    this.demandHeatmap.set(heatmap);
                    this.activities.set(activities);

                    this.chartOrders.set(this._areaChart(orders, '#34D399'));
                    this.chartProcurement.set(
                        this._columnChart(procurement, '#60A5FA')
                    );
                    this.chartHubs.set(this._columnChart(hubs, '#A78BFA'));
                    this.chartDelivery.set(
                        this._areaChart(deliveries, '#FBBF24')
                    );
                    this.chartPrices.set(this._areaChart(prices, '#F87171'));
                    this.chartDemand.set(this._columnChart(demand, '#2DD4BF'));
                    this.chartHeatmap.set(this._heatmapChart(heatmap));
                }
            )
            .finally(() => this.loading.set(false));
    }

    activityLabel(activity: AnalyticsActivity): string {
        return (
            activity.description ||
            [activity.action, activity.entityType]
                .filter(Boolean)
                .join(' · ') ||
            '—'
        );
    }

    activityTime(activity: AnalyticsActivity): string {
        const raw = activity.timestamp || activity.createdAt;
        if (!raw) {
            return '—';
        }
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? raw : date.toLocaleString();
    }

    exportDataset(dataset: string): void {
        const from = toIsoDate(this.rangeForm.controls.from.value);
        const to = toIsoDate(this.rangeForm.controls.to.value);
        if (!from || !to) {
            return;
        }
        this.exporting.set(true);
        this._analytics
            .exportDataset(dataset, from, to)
            .then((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${dataset}-${from}-${to}.csv`;
                link.click();
                URL.revokeObjectURL(url);
            })
            .catch(async (err) =>
                this._snackBar.open(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.analytics.exportError'
                    ),
                    undefined,
                    { duration: 5000 }
                )
            )
            .finally(() => this.exporting.set(false));
    }

    private _areaChart(points: AnalyticsPoint[], color: string): ApexOptions {
        return {
            chart: {
                animations: { enabled: true },
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'area',
                toolbar: { show: false },
                zoom: { enabled: false },
            },
            colors: [color],
            dataLabels: { enabled: false },
            fill: {
                colors: [color],
                opacity: 0.2,
            },
            grid: {
                borderColor: 'var(--fuse-border)',
            },
            series: [
                {
                    name: 'Series',
                    data: points.map((p) => p.value),
                },
            ],
            stroke: {
                curve: 'smooth',
                width: 2,
            },
            tooltip: {
                followCursor: true,
                theme: 'dark',
            },
            xaxis: {
                categories: points.map((p) => p.label || '—'),
                axisBorder: { show: false },
                axisTicks: { color: 'var(--fuse-border)' },
                labels: {
                    style: { colors: 'var(--fuse-text-secondary)' },
                },
            },
            yaxis: {
                labels: {
                    offsetX: -16,
                    style: { colors: 'var(--fuse-text-secondary)' },
                },
            },
        };
    }

    private _columnChart(points: AnalyticsPoint[], color: string): ApexOptions {
        return {
            chart: {
                animations: { enabled: true },
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'bar',
                toolbar: { show: false },
                zoom: { enabled: false },
            },
            colors: [color],
            dataLabels: { enabled: false },
            grid: {
                borderColor: 'var(--fuse-border)',
            },
            plotOptions: {
                bar: {
                    columnWidth: '50%',
                    borderRadius: 4,
                },
            },
            series: [
                {
                    name: 'Series',
                    data: points.map((p) => p.value),
                },
            ],
            tooltip: {
                followCursor: true,
                theme: 'dark',
            },
            xaxis: {
                categories: points.map((p) => p.label || '—'),
                axisBorder: { show: false },
                axisTicks: { color: 'var(--fuse-border)' },
                labels: {
                    style: { colors: 'var(--fuse-text-secondary)' },
                },
            },
            yaxis: {
                labels: {
                    offsetX: -16,
                    style: { colors: 'var(--fuse-text-secondary)' },
                },
            },
        };
    }

    private _heatmapChart(series: HeatmapSeries[]): ApexOptions {
        return {
            chart: {
                animations: { enabled: true },
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'heatmap',
                toolbar: { show: false },
            },
            colors: ['#2DD4BF'],
            dataLabels: { enabled: false },
            series: series.map((s) => ({
                name: s.name,
                data: s.data.map((c) => ({ x: c.x, y: c.y })),
            })),
            tooltip: {
                theme: 'dark',
            },
            xaxis: {
                axisBorder: { show: false },
                axisTicks: { color: 'var(--fuse-border)' },
                labels: {
                    style: { colors: 'var(--fuse-text-secondary)' },
                },
            },
            yaxis: {
                labels: {
                    style: { colors: 'var(--fuse-text-secondary)' },
                },
            },
        };
    }

    /** Rewrites absolute fill urls so gradients work under `<base href>`. */
    private _fixSvgFill(element: Element): void {
        const currentURL = window.location.href;
        Array.from(element.querySelectorAll('*[fill]'))
            .filter((el) => el.getAttribute('fill')?.indexOf('url(') !== -1)
            .forEach((el) => {
                const attr = el.getAttribute('fill');
                if (!attr) {
                    return;
                }
                el.setAttribute(
                    'fill',
                    `url(${currentURL}${attr.slice(attr.indexOf('#'))}`
                );
            });
    }
}
