import { NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { apiErrorMessage } from '../admin.service';
import {
    AnalyticsActivity,
    AnalyticsPoint,
    AnalyticsService,
    isoDate,
} from './analytics.service';

/** A KPI tile derived from the untyped `/analytics/overview` body. */
interface OverviewTile {
    key: string;
    value: string;
}

/** One horizontal bar: a point plus its width as a share of the series max. */
interface BarDatum extends AnalyticsPoint {
    percent: number;
}

/** Quick-link cards kept from the previous admin landing page. */
interface DashboardCard {
    icon: string;
    link: string;
    titleKey: string;
    descriptionKey: string;
}

/** Datasets `GET /analytics/export` accepts, offered in the export menu. */
const EXPORT_DATASETS = ['orders', 'procurement', 'deliveries'] as const;

/**
 * Turns a series into bars sized against the series maximum. An all-zero (or
 * empty) series yields no bars rather than a row of full-width blocks.
 */
function toBars(points: AnalyticsPoint[]): BarDatum[] {
    const max = Math.max(0, ...points.map((p) => p.value));
    if (max <= 0) {
        return [];
    }
    return points.map((point) => ({
        ...point,
        percent: Math.round((point.value / max) * 100),
    }));
}

/** `overviewTotalOrders` → `Overview total orders` for an untyped KPI key. */
function humanize(key: string): string {
    const spaced = key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim()
        .toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Admin ▸ Dashboard — the analytics landing page (`/api/v1/analytics/*`).
 *
 * The spec declares no response schemas for analytics, so the overview KPIs are
 * rendered generically from whatever scalar fields the backend returns (keys
 * humanized for display) and each series is normalised to `{ label, value }`
 * before charting. Every panel loads independently: one failing endpoint leaves
 * the rest of the dashboard usable.
 */
@Component({
    selector: 'admin-analytics-dashboard',
    templateUrl: './analytics-dashboard.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    // Full-width flex host so the page fills the screen (see ResourceCrudComponent).
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSnackBarModule,
        NgTemplateOutlet,
        ReactiveFormsModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class AdminDashboardComponent implements OnInit {
    private readonly _analytics = inject(AnalyticsService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);

    readonly loading = signal(false);
    readonly exporting = signal(false);
    readonly tiles = signal<OverviewTile[]>([]);
    readonly orderMetrics = signal<BarDatum[]>([]);
    readonly procurementMetrics = signal<BarDatum[]>([]);
    readonly hubThroughput = signal<BarDatum[]>([]);
    readonly deliveryPerformance = signal<BarDatum[]>([]);
    readonly priceTrends = signal<BarDatum[]>([]);
    readonly demandDistribution = signal<BarDatum[]>([]);
    readonly activities = signal<AnalyticsActivity[]>([]);

    readonly exportDatasets = [...EXPORT_DATASETS];

    readonly rangeForm = this._formBuilder.nonNullable.group({
        from: [isoDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000))],
        to: [isoDate(new Date())],
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
        {
            icon: 'heroicons_outline:cog-6-tooth',
            link: '/admin/settings',
            titleKey: 'admin.dashboard.settings.title',
            descriptionKey: 'admin.dashboard.settings.description',
        },
    ];

    ngOnInit(): void {
        this.reload();
    }

    reload(): void {
        const { from, to } = this.rangeForm.getRawValue();
        if (!from || !to) {
            return;
        }
        this.loading.set(true);

        // Each panel resolves independently so one 500 doesn't blank the page.
        Promise.all([
            this._analytics.getOverview().catch(() => ({})),
            this._analytics.getOrderMetrics(from, to).catch(() => []),
            this._analytics.getProcurementMetrics(from, to).catch(() => []),
            this._analytics.getHubThroughput(from, to).catch(() => []),
            this._analytics.getDeliveryPerformance(from, to).catch(() => []),
            this._analytics.getPriceTrends(from, to).catch(() => []),
            this._analytics.getDemandTimeDistribution(from, to).catch(() => []),
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
                    activities,
                ]) => {
                    this.tiles.set(
                        Object.entries(overview)
                            .filter(
                                ([, value]) =>
                                    typeof value === 'number' ||
                                    typeof value === 'string'
                            )
                            .map(([key, value]) => ({
                                key: humanize(key),
                                value: String(value),
                            }))
                    );
                    this.orderMetrics.set(toBars(orders));
                    this.procurementMetrics.set(toBars(procurement));
                    this.hubThroughput.set(toBars(hubs));
                    this.deliveryPerformance.set(toBars(deliveries));
                    this.priceTrends.set(toBars(prices));
                    this.demandDistribution.set(toBars(demand));
                    this.activities.set(activities);
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

    /** Downloads a dataset export and hands it to the browser as a file. */
    exportDataset(dataset: string): void {
        const { from, to } = this.rangeForm.getRawValue();
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
                    (await apiErrorMessage(err)) ??
                        this._transloco.translate(
                            'admin.analytics.exportError'
                        ),
                    undefined,
                    { duration: 5000 }
                )
            )
            .finally(() => this.exporting.set(false));
    }
}
