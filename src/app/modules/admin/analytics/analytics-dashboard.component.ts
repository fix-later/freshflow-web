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
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.types';
import { DateTime } from 'luxon';
import { Subject, takeUntil } from 'rxjs';
import {
    AnalyticsPoint,
    AnalyticsService,
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

const KPI_ACCENTS = [
    'text-blue-500',
    'text-red-500',
    'text-amber-500',
    'text-green-500',
] as const;

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

/**
 * Admin ▸ Dashboard (`/admin`) — Fuse project-dashboard shell with live
 * `/analytics/*` data and quick links.
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
        ReactiveFormsModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
    private readonly _analytics = inject(AnalyticsService);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _userService = inject(UserService);
    private readonly _unsubscribeAll = new Subject<void>();

    readonly loading = signal(false);
    readonly user = signal<User | null>(null);
    readonly tiles = signal<OverviewTile[]>([]);
    readonly procurementMetrics = signal<AnalyticsPoint[]>([]);
    readonly hubThroughput = signal<AnalyticsPoint[]>([]);
    readonly deliveryPerformance = signal<AnalyticsPoint[]>([]);
    readonly demandDistribution = signal<AnalyticsPoint[]>([]);

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

        Promise.all([
            this._analytics.getOrderMetrics(from, to).catch(
                (): OrderMetricsResult => ({
                    points: [],
                    totalOrders: 0,
                    totalRevenue: 0,
                    pendingOrders: 0,
                    cancelledOrders: 0,
                })
            ),
            this._analytics.getProcurementMetrics(from, to).catch(() => []),
            this._analytics.getHubThroughput(from, to).catch(() => []),
            this._analytics.getDeliveryPerformance(from, to).catch(() => []),
            this._analytics.getDemandTimeDistribution(from, to).catch(() => []),
        ])
            .then(([orders, procurement, hubs, deliveries, demand]) => {
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
                this.procurementMetrics.set(procurement);
                this.hubThroughput.set(hubs);
                this.deliveryPerformance.set(deliveries);
                this.demandDistribution.set(demand);
            })
            .finally(() => this.loading.set(false));
    }
}
