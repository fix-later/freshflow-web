import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    computed,
    effect,
    inject,
    input,
    signal,
    untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { AdminOrderGroupRow } from '../admin.types';
import {
    byReportedAtDesc,
    canAcknowledgeIncident,
    incidentReporterLabel,
    incidentStatusKey,
    incidentStatusPillClass,
    incidentTypeLabel,
} from '../incidents/incident-labels';
import { IncidentsService } from '../incidents/incidents.service';
import {
    AdminIncident,
    IncidentSource,
    SessionFailedDelivery,
} from '../incidents/incidents.types';

type SourceFilter = IncidentSource | '';
type StatusFilter = 'open' | 'acknowledged' | 'reported' | '';

/**
 * Admin ▸ Phiên chợ ▸ Báo cáo — what the people working one session reported
 * while it ran.
 *
 * Two streams reach it, the only two the backend lets an admin read back:
 * the market agents' purchase exceptions on the session's batch
 * (`GET /admin/order-groups/{batchId}` → `exceptions[]`) and the hub staff's
 * receiving discrepancies for that batch's orders
 * (`GET /hubs/{hubId}/discrepancies`). The console-wide board at
 * Admin ▸ Báo cáo sự cố reads the same two across every batch and hub; this is
 * that view narrowed to one phiên, which is the question an admin actually
 * asks while a session is open — *what went wrong at my chợ today*.
 *
 * Read-only except for one action: acknowledging a hub discrepancy, which is
 * admin-only server-side (`admin,operations_manager`) and is what unblocks the
 * hub's dispatch (BR-HUB-2).
 *
 * The batch comes in as an input rather than being fetched: the session dialog
 * already holds it for the assignment panel, so the tab adds one request (the
 * hub's discrepancy list) and no more.
 */
@Component({
    selector: 'admin-session-reports',
    templateUrl: './session-reports.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        TranslocoModule,
    ],
})
export class SessionReportsComponent {
    private readonly _incidents = inject(IncidentsService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    /** The session's procurement batch, as the dialog already loaded it. */
    readonly batch = input<AdminOrderGroupRow | null>(null);

    /** The hub this session delivers into — where its discrepancies are logged. */
    readonly hubId = input<string | null>(null);

    /**
     * Stops the drivers could not deliver, as the dialog's route walk already
     * found them. Passed in rather than fetched: the reasons live on the
     * cancelled orders, so this tab reads one order per failed stop and nothing
     * at all on a session where every stop landed.
     */
    readonly failedDeliveries = input<readonly SessionFailedDelivery[]>([]);

    /**
     * Whether the tab is the one on screen. The hub's discrepancy list is a
     * cursor-paged read the other three tabs have no use for, so nothing is
     * fetched until someone actually opens this one.
     */
    readonly active = input(false);

    /**
     * Bumped by the dialog's refresh button. Part of {@link _key}, so asking
     * for a reload invalidates what this panel has cached and it re-reads the
     * next time it is on screen — one button in the header serving every tab.
     */
    readonly reloadToken = input(0);

    readonly loading = signal(false);
    readonly loadError = signal<string | null>(null);
    /** One stream failed while the other answered — the list is incomplete. */
    readonly partial = signal(false);
    readonly reports = signal<AdminIncident[]>([]);
    readonly acknowledging = signal<string | null>(null);

    readonly source = signal<SourceFilter>('');
    readonly status = signal<StatusFilter>('');

    /** What has been loaded, so re-opening the tab does not re-fetch it. */
    private _loadedKey: string | null = null;

    constructor() {
        effect(() => {
            const key = this._key();
            const active = this.active();
            untracked(() => {
                if (!active || key === this._loadedKey) {
                    return;
                }
                this._loadedKey = key;
                void this._load();
            });
        });
    }

    readonly filtered = computed(() => {
        const source = this.source();
        const status = this.status();
        return this.reports().filter((report) => {
            if (source && report.source !== source) {
                return false;
            }
            if (!status) {
                return true;
            }
            // "Đã ghi nhận" is the absence of a lifecycle, not a third value of
            // one: a market agent's exception is a record, never open or closed.
            return status === 'reported'
                ? report.status === null
                : report.status === status;
        });
    });

    readonly hasFilters = computed(() => !!this.source() || !!this.status());

    readonly summary = computed(() => {
        const rows = this.reports();
        return {
            total: rows.length,
            procurement: rows.filter((row) => row.source === 'procurement')
                .length,
            hub: rows.filter((row) => row.source === 'hub').length,
            delivery: rows.filter((row) => row.source === 'delivery').length,
            open: rows.filter((row) => row.status === 'open').length,
        };
    });

    /** Nothing is scoped to a session before it has a batch — see the service. */
    readonly hasBatch = computed(() => !!this.batch()?.id);

    reload(): void {
        void this._load();
    }

    setSource(value: SourceFilter): void {
        this.source.set(value);
    }

    setStatus(value: StatusFilter): void {
        this.status.set(value);
    }

    clearFilters(): void {
        this.source.set('');
        this.status.set('');
    }

    typeLabel(report: AdminIncident): string {
        return incidentTypeLabel(report, (key) => this._t(key));
    }

    sourceLabel(source: IncidentSource): string {
        return this._t(`admin.incidents.source.${source}`);
    }

    statusLabel(report: AdminIncident): string {
        return this._t(incidentStatusKey(report));
    }

    statusPillClass(report: AdminIncident): string {
        return incidentStatusPillClass(report);
    }

    reporterLabel(report: AdminIncident): string {
        return incidentReporterLabel(report, (key) => this._t(key));
    }

    canAcknowledge(report: AdminIncident): boolean {
        return canAcknowledgeIncident(report);
    }

    quantity(value: number | null): string {
        return value === null ? '—' : value.toLocaleString(this._lang());
    }

    formatDate(value: string | null): string {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? '—'
            : date.toLocaleString(this._lang());
    }

    trackById(index: number, report: AdminIncident): string {
        return report.id || String(index);
    }

    /**
     * Signs off one hub discrepancy. Patched in place rather than reloaded: the
     * list is a session's worth of rows and re-reading the hub would cost a
     * cursor walk to change one pill.
     */
    acknowledge(report: AdminIncident): void {
        if (!this.canAcknowledge(report) || this.acknowledging()) {
            return;
        }
        this.acknowledging.set(report.id);
        this._incidents
            .acknowledge(report.hubId!, report.id)
            .then(() => {
                const acknowledgedAt = new Date().toISOString();
                this.reports.update((rows) =>
                    rows.map((row) =>
                        row.id === report.id
                            ? {
                                  ...row,
                                  status: 'acknowledged' as const,
                                  acknowledgedAt,
                              }
                            : row
                    )
                );
                this._notify(
                    this._t('admin.hubs.discrepancies.acknowledgeSuccess')
                );
            })
            .catch(async (err) => {
                this._notify(
                    await describeApiError(
                        err,
                        (key) => this._t(key),
                        'admin.hubs.discrepancies.acknowledgeError'
                    )
                );
            })
            .finally(() => this.acknowledging.set(null));
    }

    private _key(): string {
        return [
            this.batch()?.id ?? '',
            this.hubId() ?? '',
            // The failed stops are part of the question: a driver reporting one
            // while the dialog is open changes what this tab should list, and
            // the routes behind it are reloaded on their own tab.
            this.failedDeliveries()
                .map((delivery) => delivery.deliveryId)
                .join(','),
            String(this.reloadToken()),
        ].join('|');
    }

    /**
     * Reads the three streams independently: a hub that will not answer must
     * not hide the agents' exceptions, which came from a different endpoint and
     * are already in hand. Only a total failure is an error; anything less is a
     * warning over the rows that did arrive.
     */
    private async _load(): Promise<void> {
        const key = this._key();
        const batch = this.batch();
        const hubId = this.hubId();
        const deliveries = this.failedDeliveries();
        this.loading.set(true);
        this.loadError.set(null);
        this.partial.set(false);
        try {
            const settled = await Promise.allSettled([
                this._incidents.listSessionProcurementIncidents(batch),
                this._incidents.listSessionHubIncidents(batch, hubId),
                this._incidents.listSessionDeliveryIncidents(deliveries),
            ]);
            // The dialog may have moved to another session while this was out.
            if (key !== this._key()) {
                return;
            }
            const rows = settled.flatMap((result) =>
                result.status === 'fulfilled' ? result.value : []
            );
            this.reports.set(rows.sort(byReportedAtDesc));

            const failures = settled.filter(
                (result): result is PromiseRejectedResult =>
                    result.status === 'rejected'
            );
            if (failures.length === settled.length) {
                this.loadError.set(
                    await describeApiError(
                        failures[0].reason,
                        (translationKey) => this._t(translationKey),
                        'admin.orderGroups.marketSessions.reports.loadError'
                    )
                );
                this._loadedKey = null;
            } else if (failures.length) {
                this.partial.set(true);
            }
        } finally {
            if (key === this._key()) {
                this.loading.set(false);
            }
        }
    }

    private _t(key: string): string {
        return this._transloco.translate(key);
    }

    private _lang(): string {
        return this._transloco.getActiveLang();
    }

    private _notify(message: string): void {
        this._snackBar.open(message, undefined, { duration: 3000 });
    }
}
