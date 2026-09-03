import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    TemplateRef,
    ViewEncapsulation,
    computed,
    inject,
    input,
    signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import {
    CHART_COLORS,
    barChart,
    donutChart,
    stackedBarChart,
} from '../shared/chart-theme';
import {
    byReportedAtDesc,
    canAcknowledgeIncident,
    incidentReporterLabel,
    incidentStatusKey,
    incidentStatusPillClass,
    incidentTypeLabel,
} from './incident-labels';
import { bucketIncidents } from './incident-trend';
import { IncidentsService } from './incidents.service';
import { AdminIncident, IncidentSource } from './incidents.types';

type SourceFilter = IncidentSource | '';
type StatusFilter = 'open' | 'acknowledged' | 'reported' | '';
/** Reporting window, in days — `all` reads every incident on record. */
type WindowKey = '7' | '30' | '90' | 'all';

/** One row of the "phân loại" panel: a report type and how often it happened. */
interface TypeTile {
    type: string;
    label: string;
    source: IncidentSource;
    count: number;
    /** Share of the window's incidents, 0–100, for the bar under the count. */
    share: number;
    color: string;
}

const DAY_MS = 86_400_000;
/** How many hot spots the "điểm nóng" chart names before it stops being a list. */
const HOTSPOT_LIMIT = 8;
/**
 * One colour per stream, shared with the per-session tab so a chợ report is
 * the same indigo on both screens. `delivery` never appears in this board's
 * own data — a failed stop is only readable per session, through that
 * session's routes (see `IncidentsService.listSessionDeliveryIncidents`) — but
 * the map is total over the union, so it is coloured here rather than left to
 * a lookup that could return `undefined` if the board ever reads them.
 */
const SOURCE_COLORS: Record<IncidentSource, string> = {
    procurement: '#818CF8',
    hub: '#22D3EE',
    delivery: '#F59E0B',
};

/**
 * Admin ▸ Dashboard ▸ Báo cáo sự cố.
 *
 * A read-only report over the two incident streams an admin can actually GET —
 * market purchase exceptions (`/admin/order-groups`, which carries the same
 * `exceptions[]` as the agent's `/procurement/tasks`) and hub receiving
 * discrepancies (`/hubs/{hubId}/discrepancies`). Everything on the page is
 * counted from those two reads; nothing is estimated.
 *
 * The layout follows the Fuse Analytics/Project dashboards: a period selector
 * in the header, a KPI row, a stacked trend against its breakdown, the two
 * distribution cards, then the operational list with a detail dialog. The
 * period narrows the whole report — figures, charts and list alike — so what
 * the cards claim and what the list shows never disagree.
 */
@Component({
    selector: 'admin-incidents',
    templateUrl: './incidents.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    styles: [
        `
            .incident-grid {
                grid-template-columns:
                    minmax(0, 1.3fr) minmax(0, 1.1fr) minmax(0, 0.9fr)
                    6rem minmax(0, 1fr) 8rem 7rem;
            }

            .incident-grid > * {
                min-width: 0;
            }
        `,
    ],
    imports: [
        MatButtonModule,
        MatButtonToggleModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        NgApexchartsModule,
        ReactiveFormsModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class AdminIncidentsComponent implements OnInit {
    private readonly _incidents = inject(IncidentsService);
    private readonly _dialog = inject(MatDialog);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private _detailRef: MatDialogRef<unknown> | null = null;

    readonly embedded = input(false);
    readonly loading = signal(false);
    readonly loadError = signal<string | null>(null);
    readonly incidents = signal<AdminIncident[]>([]);
    readonly acknowledging = signal<string | null>(null);
    readonly viewing = signal<AdminIncident | null>(null);

    readonly windows: readonly WindowKey[] = ['7', '30', '90', 'all'];
    readonly window = signal<WindowKey>('30');

    readonly search = new FormControl('', { nonNullable: true });
    readonly source = new FormControl<SourceFilter>('', { nonNullable: true });
    readonly status = new FormControl<StatusFilter>('', { nonNullable: true });
    readonly kind = new FormControl('', { nonNullable: true });
    private readonly _search = signal('');
    private readonly _source = signal<SourceFilter>('');
    private readonly _status = signal<StatusFilter>('');
    private readonly _kind = signal('');

    /** The selected period in days, or `null` for the whole record. */
    readonly windowDays = computed(() => {
        const key = this.window();
        return key === 'all' ? null : Number(key);
    });

    /**
     * Every figure below reads this, not `incidents()`.
     *
     * A report with no timestamp cannot be placed in a period, and dropping it
     * would hide a real incident, so it stays in every window.
     */
    readonly windowed = computed(() => {
        const days = this.windowDays();
        if (days === null) {
            return this.incidents();
        }
        const from = this._startOfDay(Date.now()) - (days - 1) * DAY_MS;
        return this.incidents().filter((incident) => {
            const time = this._time(incident.reportedAt);
            return time === null || time >= from;
        });
    });

    readonly kindOptions = computed(() =>
        [...new Set(this.windowed().map((incident) => incident.type))]
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right, 'vi'))
    );

    readonly filtered = computed(() => {
        const search = this._search().trim().toLocaleLowerCase('vi');
        const source = this._source();
        const status = this._status();
        const kind = this._kind();
        return this.windowed().filter((incident) => {
            if (source && incident.source !== source) {
                return false;
            }
            if (kind && incident.type !== kind) {
                return false;
            }
            if (
                status &&
                (status === 'reported'
                    ? incident.status !== null
                    : incident.status !== status)
            ) {
                return false;
            }
            return (
                !search ||
                [
                    this.typeLabel(incident),
                    incident.subject,
                    incident.context,
                    incident.place,
                    incident.note,
                    incident.reporterName,
                ].some((value) =>
                    String(value ?? '')
                        .toLocaleLowerCase('vi')
                        .includes(search)
                )
            );
        });
    });

    readonly hasFilters = computed(
        () =>
            !!(
                this._search() ||
                this._source() ||
                this._status() ||
                this._kind()
            )
    );

    /** The four KPI figures, each with the second number printed under it. */
    readonly summary = computed(() => {
        const rows = this.windowed();
        const since = Date.now() - DAY_MS;
        const procurement = rows.filter((row) => row.source === 'procurement');
        const hub = rows.filter((row) => row.source === 'hub');
        return {
            total: rows.length,
            last24h: rows.filter((row) => {
                const time = this._time(row.reportedAt);
                return time !== null && time >= since;
            }).length,
            open: hub.filter((row) => row.status === 'open').length,
            acknowledged: hub.filter((row) => row.status === 'acknowledged')
                .length,
            procurement: procurement.length,
            markets: this._distinctPlaces(procurement),
            hub: hub.length,
            hubs: this._distinctPlaces(hub),
        };
    });

    /** Incidents per day (per week past a month), split by where they came from. */
    readonly trendChart = computed<ApexOptions>(() => {
        const { buckets, weekly } = bucketIncidents(
            this.windowed(),
            this.windowDays()
        );
        return stackedBarChart(
            buckets.map((bucket) => this._bucketLabel(bucket.start, weekly)),
            [
                {
                    name: this._t('admin.incidents.source.procurement'),
                    data: buckets.map((bucket) => bucket.procurement),
                },
                {
                    name: this._t('admin.incidents.source.hub'),
                    data: buckets.map((bucket) => bucket.hub),
                },
            ],
            {
                colors: [SOURCE_COLORS.procurement, SOURCE_COLORS.hub],
                format: (value) => this._number(value),
                height: 320,
                rotateLabels: buckets.length > 12 ? -45 : 0,
            }
        );
    });

    /** How the report types split, most frequent first. */
    readonly typeTiles = computed<TypeTile[]>(() => {
        const rows = this.windowed();
        const counts = new Map<string, TypeTile>();
        for (const incident of rows) {
            const key = `${incident.source}:${incident.type}`;
            const tile = counts.get(key);
            if (tile) {
                tile.count += 1;
                continue;
            }
            counts.set(key, {
                type: incident.type,
                label: this.typeLabel(incident),
                source: incident.source,
                count: 1,
                share: 0,
                color: SOURCE_COLORS[incident.source],
            });
        }
        return [...counts.values()]
            .map((tile) => ({
                ...tile,
                share: rows.length ? (tile.count / rows.length) * 100 : 0,
            }))
            .sort((left, right) => right.count - left.count);
    });

    readonly statusChart = computed<ApexOptions>(() => {
        const rows = this.windowed();
        const points = [
            {
                label: this._t('admin.incidents.status.open'),
                value: rows.filter((row) => row.status === 'open').length,
            },
            {
                label: this._t('admin.incidents.status.acknowledged'),
                value: rows.filter((row) => row.status === 'acknowledged')
                    .length,
            },
            {
                label: this._t('admin.incidents.status.reported'),
                value: rows.filter((row) => row.status === null).length,
            },
        ].filter((point) => point.value > 0);
        return donutChart(points, {
            colors: ['#f59e0b', '#22c55e', '#64748b'],
            format: (value) => this._number(value),
        });
    });

    /** The places reporting most — which chợ and which hub to look at first. */
    readonly hotspots = computed(() => {
        const counts = new Map<string, number>();
        for (const incident of this.windowed()) {
            const place = incident.place?.trim();
            if (!place) {
                continue;
            }
            counts.set(place, (counts.get(place) ?? 0) + 1);
        }
        return [...counts.entries()]
            .map(([label, value]) => ({ label, value }))
            .sort((left, right) => right.value - left.value)
            .slice(0, HOTSPOT_LIMIT);
    });

    readonly hotspotChart = computed<ApexOptions>(() =>
        barChart(this.hotspots(), {
            horizontal: true,
            colors: [...CHART_COLORS],
            format: (value) => this._number(value),
            height: 320,
        })
    );

    ngOnInit(): void {
        this._load();
        this.search.valueChanges.subscribe((value) => this._search.set(value));
        this.source.valueChanges.subscribe((value) => this._source.set(value));
        this.status.valueChanges.subscribe((value) => this._status.set(value));
        this.kind.valueChanges.subscribe((value) => this._kind.set(value));
    }

    reload(): void {
        this._load();
    }

    /** Narrowing the period can strand a type filter with nothing to match. */
    selectWindow(key: WindowKey): void {
        this.window.set(key);
        if (this._kind() && !this.kindOptions().includes(this._kind())) {
            this.kind.setValue('');
        }
    }

    windowLabel(key: WindowKey): string {
        return key === 'all'
            ? this._t('admin.incidents.window.all')
            : this._transloco.translate('admin.incidents.window.days', {
                  count: Number(key),
              });
    }

    clearFilters(): void {
        this.search.setValue('');
        this.source.setValue('');
        this.status.setValue('');
        this.kind.setValue('');
    }

    openDetail(incident: AdminIncident, template: TemplateRef<unknown>): void {
        if (this._detailRef) {
            return;
        }
        this.viewing.set(incident);
        this._detailRef = this._dialog.open(template, {
            autoFocus: 'dialog',
            maxWidth: '95vw',
        });
        this._detailRef.afterClosed().subscribe(() => {
            this._detailRef = null;
            this.viewing.set(null);
        });
    }

    closeDetail(): void {
        this._detailRef?.close();
    }

    canAcknowledge(incident: AdminIncident): boolean {
        return canAcknowledgeIncident(incident);
    }

    acknowledge(incident: AdminIncident): void {
        if (!this.canAcknowledge(incident) || this.acknowledging()) {
            return;
        }
        this.acknowledging.set(incident.id);
        this._incidents
            .acknowledge(incident.hubId!, incident.id)
            .then(() => {
                const acknowledgedAt = new Date().toISOString();
                const patch = (row: AdminIncident): AdminIncident =>
                    row.id === incident.id
                        ? {
                              ...row,
                              status: 'acknowledged',
                              acknowledgedAt,
                          }
                        : row;
                this.incidents.update((rows) => rows.map(patch));
                this.viewing.update((row) => (row ? patch(row) : row));
                this._notify(
                    this._t('admin.hubs.discrepancies.acknowledgeSuccess')
                );
            })
            .catch(async (err) => {
                this._notify(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.hubs.discrepancies.acknowledgeError'
                    )
                );
            })
            .finally(() => this.acknowledging.set(null));
    }

    typeLabel(incident: AdminIncident): string {
        return incidentTypeLabel(incident, (key) => this._t(key));
    }

    kindLabel(type: string): string {
        const incident = this.windowed().find((row) => row.type === type);
        return incident ? this.typeLabel(incident) : type || '—';
    }

    sourceLabel(source: IncidentSource): string {
        return this._t(`admin.incidents.source.${source}`);
    }

    statusLabel(incident: AdminIncident): string {
        return this._t(incidentStatusKey(incident));
    }

    statusPillClass(incident: AdminIncident): string {
        return incidentStatusPillClass(incident);
    }

    reporterLabel(incident: AdminIncident): string {
        return incidentReporterLabel(incident, (key) => this._t(key));
    }

    quantity(value: number | null): string {
        return value === null ? '—' : this._number(value);
    }

    count(value: number): string {
        return this._number(value);
    }

    formatDate(value: string | null): string {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? '—'
            : date.toLocaleString(this._transloco.getActiveLang());
    }

    trackById(index: number, incident: AdminIncident): string {
        return incident.id || String(index);
    }

    private _t(key: string): string {
        return this._transloco.translate(key);
    }

    private _number(value: number): string {
        return value.toLocaleString(this._transloco.getActiveLang());
    }

    private _time(value: string | null): number | null {
        if (!value) {
            return null;
        }
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
    }

    private _startOfDay(value: number): number {
        const date = new Date(value);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    private _distinctPlaces(rows: readonly AdminIncident[]): number {
        return new Set(
            rows.map((row) => row.place?.trim()).filter((place) => !!place)
        ).size;
    }

    /** Day as `17/08`, week as the day its bucket opens — the axis is dense. */
    private _bucketLabel(start: number, weekly: boolean): string {
        const label = new Date(start).toLocaleDateString(
            this._transloco.getActiveLang(),
            { day: '2-digit', month: '2-digit' }
        );
        return weekly ? `${label}+` : label;
    }

    private _load(): void {
        this.loading.set(true);
        this.loadError.set(null);
        Promise.allSettled([
            this._incidents.listProcurementIncidents(),
            this._incidents.listHubIncidents(),
        ])
            .then(async ([procurement, hub]) => {
                const rows = [
                    ...(procurement.status === 'fulfilled'
                        ? procurement.value
                        : []),
                    ...(hub.status === 'fulfilled' ? hub.value : []),
                ];
                this.incidents.set(rows.sort(byReportedAtDesc));
                if (
                    procurement.status === 'rejected' &&
                    hub.status === 'rejected'
                ) {
                    this.loadError.set(
                        await describeApiError(
                            procurement.reason,
                            (key) => this._transloco.translate(key),
                            'admin.incidents.loadError'
                        )
                    );
                }
            })
            .finally(() => this.loading.set(false));
    }

    private _notify(message: string): void {
        this._snackBar.open(message, undefined, { duration: 3000 });
    }
}
