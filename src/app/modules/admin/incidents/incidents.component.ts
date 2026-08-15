import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    input,
    signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { normalizeClaimStatus } from 'app/modules/orders/claims.types';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { ClaimsService } from '../claims/claims.service';
import { AdminClaimRow } from '../claims/claims.types';
import {
    CHART_COLORS,
    CHART_STATUS_COLORS,
    donutChart,
} from '../shared/chart-theme';
import { IncidentsService } from './incidents.service';
import { AdminIncident, IncidentSource } from './incidents.types';

/** `''` is "no filter" for both selects. */
type SourceFilter = IncidentSource | '';
type StatusFilter = 'open' | 'acknowledged' | 'reported' | '';

/**
 * Admin ▸ Dashboard ▸ Báo cáo sự cố — every issue report the console can read,
 * on one board.
 *
 * Two streams feed it and they are unlike each other: a market agent's
 * exception at the chợ is a *record* of what happened, while a hub's receiving
 * discrepancy is a *queue item* that blocks the hub from dispatching until an
 * admin signs it off (BR-HUB-2). They are listed together because an operator
 * asking "what went wrong today" wants both, and told apart by the source chip
 * and by which rows carry an action.
 *
 * The claims summary sits here too — how many refund claims are waiting is part
 * of the same question, and the Khiếu nại tab next door is then free to be the
 * review queue rather than a dashboard.
 */
@Component({
    selector: 'admin-incidents',
    templateUrl: './incidents.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
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
    private readonly _claims = inject(ClaimsService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    /** True when the dashboard's tab bar already names this section. */
    readonly embedded = input(false);

    readonly loading = signal(false);
    readonly loadError = signal<string | null>(null);
    readonly incidents = signal<AdminIncident[]>([]);
    readonly claims = signal<AdminClaimRow[]>([]);
    /** The row currently being acknowledged, so only its button spins. */
    readonly acknowledging = signal<string | null>(null);

    readonly source = new FormControl<SourceFilter>('', { nonNullable: true });
    readonly status = new FormControl<StatusFilter>('', { nonNullable: true });
    /** Mirrors the controls, since a `FormControl` is not a signal. */
    private readonly _source = signal<SourceFilter>('');
    private readonly _status = signal<StatusFilter>('');

    readonly filtered = computed(() => {
        const source = this._source();
        const status = this._status();
        return this.incidents().filter((incident) => {
            if (source && incident.source !== source) {
                return false;
            }
            if (!status) {
                return true;
            }
            // "reported" is the procurement rows — the ones with no lifecycle
            // at all. Without it they could only be reached by source, which
            // conflates "has no status" with "not filtered".
            return status === 'reported'
                ? incident.status === null
                : incident.status === status;
        });
    });

    /** What the four tiles count, over everything loaded rather than the filter. */
    readonly summary = computed(() => {
        const rows = this.incidents();
        const claims = this.claims();
        let pendingClaims = 0;
        let pendingAmount = 0;
        for (const claim of claims) {
            if (normalizeClaimStatus(claim.status) === 'submitted') {
                pendingClaims += 1;
                pendingAmount += claim.amount ?? 0;
            }
        }
        return {
            open: rows.filter((row) => row.status === 'open').length,
            procurement: rows.filter((row) => row.source === 'procurement')
                .length,
            pendingClaims,
            pendingAmount,
        };
    });

    /**
     * What is going wrong, by kind — the two sources' vocabularies side by side
     * (`Unavailable`/`Shortfall`/… and `MISSING`/`DAMAGED`/`PARTIAL`), each
     * under its own label, since a hub's DAMAGED and an agent's Damaged are not
     * the same event.
     */
    readonly typeChart = computed<ApexOptions>(() => {
        const counts = new Map<string, number>();
        for (const incident of this.incidents()) {
            const key = this.typeLabel(incident);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const points = [...counts.entries()]
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value);

        return donutChart(points, {
            colors: [...CHART_COLORS],
            format: (value) => this._number(value),
        });
    });

    /**
     * The claims queue's split by state. Fixed semantic colours — amber is
     * awaiting a decision, green approved, red rejected — so it reads the same
     * way as the status pills on the Khiếu nại tab.
     */
    readonly claimsChart = computed<ApexOptions>(() => {
        const counts = { submitted: 0, approved: 0, rejected: 0 };
        for (const claim of this.claims()) {
            const status = normalizeClaimStatus(claim.status);
            if (status) {
                counts[status] += 1;
            }
        }
        const points = [
            {
                label: this._claimStatusLabel('submitted'),
                value: counts.submitted,
            },
            {
                label: this._claimStatusLabel('approved'),
                value: counts.approved,
            },
            {
                label: this._claimStatusLabel('rejected'),
                value: counts.rejected,
            },
        ].filter((point) => point.value > 0);

        return donutChart(points, {
            colors: [
                CHART_STATUS_COLORS.warn,
                CHART_STATUS_COLORS.good,
                CHART_STATUS_COLORS.bad,
            ],
            format: (value) => this._number(value),
        });
    });

    ngOnInit(): void {
        this._load();
        this.source.valueChanges.subscribe((value) => this._source.set(value));
        this.status.valueChanges.subscribe((value) => this._status.set(value));
    }

    reload(): void {
        this._load();
    }

    /**
     * Only an open hub discrepancy can be signed off. A procurement exception
     * has nothing to sign off, and an acknowledged one is already done.
     */
    canAcknowledge(incident: AdminIncident): boolean {
        return (
            incident.source === 'hub' &&
            incident.status === 'open' &&
            !!incident.hubId
        );
    }

    acknowledge(incident: AdminIncident): void {
        if (!this.canAcknowledge(incident) || this.acknowledging()) {
            return;
        }
        this.acknowledging.set(incident.id);
        this._incidents
            .acknowledge(incident.hubId!, incident.id)
            .then(() => {
                this._notify(
                    this._transloco.translate(
                        'admin.hubs.discrepancies.acknowledgeSuccess'
                    )
                );
                // Patched in place rather than refetched: the board is two
                // aggregations deep, and a full reload to move one chip is a
                // walk of every hub.
                this.incidents.update((rows) =>
                    rows.map((row) =>
                        row.id === incident.id
                            ? { ...row, status: 'acknowledged' as const }
                            : row
                    )
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

    /** The incident's kind, under the vocabulary of the source that raised it. */
    typeLabel(incident: AdminIncident): string {
        const token = incident.type.trim();
        if (!token) {
            return '—';
        }
        const key =
            incident.source === 'procurement'
                ? `admin.orderGroups.exceptionType.${token}`
                : `admin.incidents.condition.${token.toLowerCase()}`;
        const label = this._transloco.translate(key);
        return label === key ? token : label;
    }

    statusLabel(incident: AdminIncident): string {
        const key = incident.status
            ? `admin.incidents.status.${incident.status}`
            : 'admin.incidents.status.reported';
        return this._transloco.translate(key);
    }

    /** Amber blocks a hub, grey is signed off, slate is a bare record. */
    statusPillClass(incident: AdminIncident): string {
        switch (incident.status) {
            case 'open':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
            case 'acknowledged':
                return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200';
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
        }
    }

    quantity(value: number | null): string {
        return value === null ? '—' : this._number(value);
    }

    money(value: number): string {
        return `${this._number(value)} ₫`;
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

    private _claimStatusLabel(status: string): string {
        const key = `admin.claims.status.${status}`;
        const label = this._transloco.translate(key);
        return label === key ? status : label;
    }

    private _number(value: number): string {
        return value.toLocaleString(this._transloco.getActiveLang());
    }

    /**
     * The three reads, each landing on its own.
     *
     * `Promise.allSettled`, not `all`: the hub walk is the fragile one (a hub
     * per request) and the claims summary is a courtesy. Either failing must
     * not blank the procurement list, which is the board's cheapest and most
     * complete stream. Only a total failure is reported as an error.
     */
    private _load(): void {
        this.loading.set(true);
        this.loadError.set(null);
        Promise.allSettled([
            this._incidents.listProcurementIncidents(),
            this._incidents.listHubIncidents(),
            this._claims.listClaims(),
        ])
            .then(async ([procurement, hub, claims]) => {
                const rows = [
                    ...(procurement.status === 'fulfilled'
                        ? procurement.value
                        : []),
                    ...(hub.status === 'fulfilled' ? hub.value : []),
                ];
                // Newest first, and rows with no timestamp last rather than
                // sorted as if they were from 1970.
                this.incidents.set(
                    rows.sort((a, b) =>
                        (b.reportedAt ?? '').localeCompare(a.reportedAt ?? '')
                    )
                );
                this.claims.set(
                    claims.status === 'fulfilled' ? claims.value.claims : []
                );
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
