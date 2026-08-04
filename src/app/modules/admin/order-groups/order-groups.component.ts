import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    TemplateRef,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import {
    AbstractControl,
    FormBuilder,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { readApiError } from 'app/core/api/envelope';
import { describeApiError } from 'app/core/api/error-codes';
import { includesFolded } from 'app/core/util/text-search';
import { DateTime } from 'luxon';
import { AdminService } from '../admin.service';
import {
    AdminAutoBatchBatch,
    AdminAutoBatchResult,
    AdminOrderGroupProgress,
    AdminOrderGroupRow,
    AdminUserRow,
} from '../admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { ADMIN_DEFAULT_PAGE_SIZE } from '../shared/admin-pagination';
import { CoalescedTask } from '../shared/coalesced-task';
import { TableSort } from '../shared/table-sort';
import { statusLabelKey, statusPillClass } from './order-group-status';

/**
 * Reasons the run reports for doing nothing (`{"skipped":true,"reason":…}`).
 * Verified live: a run with nothing to group answers `no_eligible_orders`.
 * Anything unlisted falls back to the raw code rather than an empty banner.
 */
const KNOWN_SKIP_REASONS = new Set([
    'no_eligible_orders',
    'already_batched',
    'batching_disabled',
    'outside_window',
]);

/** Optional Luxon day from the Material datepicker. */
function validTargetDate(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (value == null || value === '') {
        return null;
    }
    return DateTime.isDateTime(value) && value.isValid
        ? null
        : { invalidDate: true };
}

/**
 * Admin ▸ Order groups — Fuse inventory list of procurement batches with
 * auto-batch / manifest / agent / cancel actions.
 */
@Component({
    selector: 'admin-order-groups',
    templateUrl: './order-groups.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatDatepickerModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatProgressBarModule,
        MatCheckboxModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
    styles: [
        `
            .order-groups-grid {
                /* market | status | agent | actions */
                grid-template-columns:
                    minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 1.4fr)
                    3.5rem;

                @screen md {
                    /* + orders */
                    grid-template-columns:
                        minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 0.55fr)
                        minmax(0, 1.4fr) 3.5rem;
                }

                @screen lg {
                    /* + created */
                    grid-template-columns:
                        minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 0.55fr)
                        minmax(0, 1fr) minmax(0, 1.4fr) 3.5rem;
                }
            }
        `,
    ],
})
export class OrderGroupsComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _dialog = inject(MatDialog);
    private readonly _router = inject(Router);

    readonly statusPillClass = statusPillClass;

    private _batchDialogRef: MatDialogRef<unknown> | null = null;
    private _resetDialogRef: MatDialogRef<unknown> | null = null;
    private _agentDialogRef: MatDialogRef<unknown> | null = null;

    readonly groups = signal<AdminOrderGroupRow[]>([]);
    readonly agents = signal<AdminUserRow[]>([]);
    readonly markets = signal<{ id: string; name: string }[]>([]);
    readonly totalCount = signal(0);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    readonly loading = signal(false);

    /**
     * Server-side batching progress (`GET /admin/order-groups/progress`).
     * The table lists the batches; this says how far the run itself has got,
     * which is the question an operator has while it is still running.
     */
    readonly progress = signal<AdminOrderGroupProgress | null>(null);

    /** The run's own figures, or `null` when the endpoint reports no run. */
    readonly progressSummary = computed(() => this.progress()?.summary ?? null);

    /**
     * Items purchased as a percentage of items in the run. The endpoint counts
     * **items**, not batches — a batch sits at "Built" for as long as it takes
     * its agent to buy every line, so batch counts barely move while the run
     * is actually progressing.
     */
    readonly progressPercent = computed(() => {
        const s = this.progressSummary();
        const total = Number(s?.totalItems ?? 0);
        if (!total) {
            return null;
        }
        return Math.round((Number(s?.itemsPurchased ?? 0) / total) * 100);
    });

    /** Exceptions still open across the run — the number that needs an owner. */
    readonly openExceptions = computed(() =>
        Number(this.progressSummary()?.openExceptions ?? 0)
    );
    readonly batching = signal(false);
    readonly resetting = signal(false);
    readonly search = signal('');
    /** Inclusive client-side date range on `createdAt` / batch date. */
    readonly dateFrom = signal<DateTime | null>(null);
    readonly dateTo = signal<DateTime | null>(null);
    /** Empty string = all. */
    readonly statusFilter = signal('');
    readonly marketFilter = signal('');
    readonly agentFilter = signal('');

    /** Batch lifecycle statuses for the status filter. */
    readonly statusOptions = [
        'Built',
        'Manifested',
        'Purchasing',
        'HandedOff',
        'Completed',
        'Cancelled',
    ] as const;

    /** Structured result of the last auto-batch run (dry or applied). */
    readonly autoBatchResult = signal<AdminAutoBatchResult | null>(null);
    /** Explained failure of the last auto-batch run, shown as a banner. */
    readonly autoBatchError = signal<{
        message: string;
        severity: 'error' | 'warning';
    } | null>(null);

    /** Row targeted by the assign-agent dialog. */
    readonly agentDialogBatch = signal<AdminOrderGroupRow | null>(null);
    readonly agentDialogSaving = signal(false);
    readonly agentForm = new FormGroup({
        agentUserId: new FormControl('', { nonNullable: true }),
    });

    readonly sort = new TableSort<AdminOrderGroupRow>();

    readonly filteredGroups = computed(() => {
        const term = this.search().trim();
        const from = this.dateFrom();
        const to = this.dateTo();
        const status = this.statusFilter().trim().toLowerCase();
        const marketId = this.marketFilter().trim();
        const agentId = this.agentFilter().trim();
        const fromDay =
            from && DateTime.isDateTime(from) && from.isValid
                ? from.startOf('day')
                : null;
        const toDay =
            to && DateTime.isDateTime(to) && to.isValid
                ? to.startOf('day')
                : null;

        return this.groups().filter((group) => {
            if (status) {
                if (String(group.status ?? '').toLowerCase() !== status) {
                    return false;
                }
            }
            if (marketId) {
                if (String(group.marketId ?? '') !== marketId) {
                    return false;
                }
            }
            if (agentId) {
                const assigned =
                    group.agentId ??
                    (group['assignedAgentUserId'] as string | null) ??
                    '';
                if (String(assigned) !== agentId) {
                    return false;
                }
            }
            if (fromDay || toDay) {
                const day = this._batchDay(group);
                if (!day) {
                    return false;
                }
                if (fromDay && day < fromDay) {
                    return false;
                }
                if (toDay && day > toDay) {
                    return false;
                }
            }
            if (!term) {
                return true;
            }
            const agent = this.agentFor(group);
            const agentText = agent
                ? `${agent.email ?? ''} ${String(agent['name'] ?? '')}`
                : String(group.agentEmail ?? '');
            return (
                includesFolded(String(group.marketName ?? ''), term) ||
                includesFolded(agentText, term) ||
                includesFolded(this.statusLabel(group.status), term)
            );
        });
    });

    readonly hasActiveFilters = computed(
        () =>
            !!this.search().trim() ||
            !!this.dateFrom() ||
            !!this.dateTo() ||
            !!this.statusFilter() ||
            !!this.marketFilter() ||
            !!this.agentFilter()
    );

    readonly sortedGroups = computed(() =>
        this.sort.apply(
            this.filteredGroups(),
            (group, key) => group[key] as string | number | null
        )
    );

    /** Client-side page slice — search/filters run over the full loaded set. */
    readonly pagedGroups = computed(() => {
        const rows = this.sortedGroups();
        const start = this.pageIndex() * this.pageSize();
        return rows.slice(start, start + this.pageSize());
    });

    readonly filteredTotal = computed(() => this.filteredGroups().length);

    readonly batchForm = this._formBuilder.group({
        targetDate: this._formBuilder.control<DateTime | null>(null, {
            validators: [validTargetDate],
        }),
        dryRun: this._formBuilder.nonNullable.control(true),
        force: this._formBuilder.nonNullable.control(false),
    });

    /**
     * Reset form. `confirmation` is whatever phrase the backend demands —
     * it's forwarded verbatim, so a wrong one fails server-side rather than
     * being second-guessed here.
     */
    readonly resetForm = this._formBuilder.group({
        targetDate: this._formBuilder.control<DateTime | null>(null, {
            validators: [validTargetDate],
        }),
        confirmation: this._formBuilder.nonNullable.control('', {
            validators: [Validators.required],
        }),
    });

    ngOnInit(): void {
        this._load();
        this._admin
            .getAgentOptions()
            .then((agents) => this.agents.set(agents))
            .catch(() => this.agents.set([]));
        this._admin
            .getMarkets()
            .then((markets) =>
                this.markets.set(
                    markets.map((m) => ({
                        id: String(m.id),
                        name: String(m.name ?? m.id),
                    }))
                )
            )
            .catch(() => this.markets.set([]));
    }

    onSearch(value: string): void {
        this.search.set(value);
        this.pageIndex.set(0);
    }

    onDateFromChange(value: DateTime | null): void {
        this.dateFrom.set(
            value && DateTime.isDateTime(value) && value.isValid ? value : null
        );
        this.pageIndex.set(0);
    }

    onDateToChange(value: DateTime | null): void {
        this.dateTo.set(
            value && DateTime.isDateTime(value) && value.isValid ? value : null
        );
        this.pageIndex.set(0);
    }

    onStatusFilterChange(value: string): void {
        this.statusFilter.set(value ?? '');
        this.pageIndex.set(0);
    }

    onMarketFilterChange(value: string): void {
        this.marketFilter.set(value ?? '');
        this.pageIndex.set(0);
    }

    onAgentFilterChange(value: string): void {
        this.agentFilter.set(value ?? '');
        this.pageIndex.set(0);
    }

    clearFilters(): void {
        this.search.set('');
        this.dateFrom.set(null);
        this.dateTo.set(null);
        this.statusFilter.set('');
        this.marketFilter.set('');
        this.agentFilter.set('');
        this.pageIndex.set(0);
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
    }

    trackById(index: number, row: AdminOrderGroupRow): string {
        return this.batchIdOf(row) || String(index);
    }

    batchIdOf(row: AdminOrderGroupRow): string {
        return row.id ?? '';
    }

    /** Opens the full-detail page for a batch, passing the row for instant render. */
    openDetail(row: AdminOrderGroupRow): void {
        const id = this.batchIdOf(row);
        if (!id) {
            return;
        }
        this._router.navigate(['/admin/order-groups', id], {
            state: { batch: row },
        });
    }

    // ---- Auto-batch -------------------------------------------------------

    openAutoBatch(template: TemplateRef<unknown>): void {
        if (this._batchDialogRef) {
            return;
        }
        this.autoBatchError.set(null);
        this._batchDialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._batchDialogRef.afterClosed().subscribe(() => {
            this._batchDialogRef = null;
        });
    }

    closeAutoBatch(): void {
        this._batchDialogRef?.close();
    }

    runAutoBatch(): void {
        if (this.batchForm.invalid) {
            this.batchForm.markAllAsTouched();
            return;
        }
        const { targetDate, dryRun, force } = this.batchForm.getRawValue();
        const dateIso =
            targetDate && DateTime.isDateTime(targetDate) && targetDate.isValid
                ? targetDate.toISODate()
                : null;
        this.batching.set(true);
        this.autoBatchResult.set(null);
        this.autoBatchError.set(null);
        this._admin
            .runAutoBatch({
                targetDate: dateIso,
                dryRun: dryRun ?? true,
                force: force ?? false,
            })
            .then((result) => {
                this.autoBatchResult.set(result);
                this.closeAutoBatch();
                if (!dryRun) {
                    this._notifyKey('admin.orderGroups.autoBatch.success');
                    this._load();
                }
            })
            .catch((err) => void this._handleAutoBatchError(err))
            .finally(() => this.batching.set(false));
    }

    dismissAutoBatchResult(): void {
        this.autoBatchResult.set(null);
    }

    // ---- Reset the day's batches -----------------------------------------

    openReset(template: TemplateRef<unknown>): void {
        if (this._resetDialogRef) {
            return;
        }
        this.resetForm.reset({ targetDate: null, confirmation: '' });
        this.autoBatchError.set(null);
        this._resetDialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._resetDialogRef.afterClosed().subscribe(() => {
            this._resetDialogRef = null;
        });
    }

    closeReset(): void {
        this._resetDialogRef?.close();
    }

    runReset(): void {
        if (this.resetForm.invalid || this.resetting()) {
            this.resetForm.markAllAsTouched();
            return;
        }
        const { targetDate, confirmation } = this.resetForm.getRawValue();
        const dateIso =
            targetDate && DateTime.isDateTime(targetDate) && targetDate.isValid
                ? targetDate.toISODate()
                : null;
        this.resetting.set(true);
        this._admin
            .resetOrderGroups({ targetDate: dateIso, confirmation })
            .then(() => {
                this.closeReset();
                this.autoBatchResult.set(null);
                this._notifyKey('admin.orderGroups.reset.success');
                this._load();
            })
            .catch(
                (err) => void this._handleAutoBatchError(err, this.resetForm)
            )
            .finally(() => this.resetting.set(false));
    }

    /**
     * Batches the run produced. A dry run persists nothing, so `batchesCreated`
     * is 0 even when it has a full preview — the preview length is the honest
     * answer to "how many would this make".
     */
    resultBatchCount(result: AdminAutoBatchResult): number {
        return result.dryRun
            ? result.preview?.length ?? 0
            : result.batchesCreated ?? 0;
    }

    /** Orders the run absorbed, counted from the preview on a dry run. */
    resultOrderCount(result: AdminAutoBatchResult): number {
        if (!result.dryRun) {
            return result.ordersBatched ?? 0;
        }
        const ids = new Set<string>();
        for (const batch of result.preview ?? []) {
            for (const id of batch.coveredOrderIds ?? []) {
                ids.add(String(id));
            }
        }
        return ids.size;
    }

    /** Market name for a previewed batch, falling back to its id. */
    previewMarketLabel(batch: AdminAutoBatchBatch): string {
        const id = String(batch.marketId ?? '');
        return this.markets().find((m) => m.id === id)?.name || id || '—';
    }

    /** Localized reason the run grouped nothing (raw code as fallback). */
    skipReasonLabel(reason: string | null | undefined): string {
        const code = String(reason ?? '')
            .trim()
            .toLowerCase();
        if (!code) {
            return this._transloco.translate(
                'admin.orderGroups.skipReason.unknown'
            );
        }
        return KNOWN_SKIP_REASONS.has(code)
            ? this._transloco.translate('admin.orderGroups.skipReason.' + code)
            : String(reason);
    }

    /**
     * Turns an auto-batch / reset failure into an explained, localized banner,
     * flagging the offending date field on `form` when the server rejects it.
     */
    private async _handleAutoBatchError(
        err: unknown,
        form: {
            controls: { targetDate: AbstractControl };
        } = this.batchForm
    ): Promise<void> {
        const info = await readApiError(err);
        const message = await describeApiError(
            err,
            (key) => this._transloco.translate(key),
            'admin.orderGroups.actionError'
        );
        const alreadyRunning =
            info?.code === 'AUTO_BATCH_ALREADY_RUNNING' ||
            info?.code === 'BUSINESS_RULE_ERROR' ||
            info?.status === 409;
        if (info?.code === 'VALIDATION_ERROR' || info?.status === 400) {
            form.controls.targetDate.setErrors({ server: true });
        }
        this.autoBatchError.set({
            message,
            severity: alreadyRunning ? 'warning' : 'error',
        });
    }

    // ---- Row actions ------------------------------------------------------

    agentFor(row: AdminOrderGroupRow): AdminUserRow | undefined {
        const id = row.agentId;
        return id ? this.agents().find((agent) => agent.id === id) : undefined;
    }

    agentLabel(row: AdminOrderGroupRow): string {
        const agent = this.agentFor(row);
        if (!agent) {
            return row.agentEmail ?? '';
        }
        return agent.email || String(agent['name'] ?? '');
    }

    openAgentDialog(
        row: AdminOrderGroupRow,
        template: TemplateRef<unknown>
    ): void {
        this.agentDialogBatch.set(row);
        this.agentForm.reset({ agentUserId: row.agentId ?? '' });
        this.agentDialogSaving.set(false);
        this._agentDialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._agentDialogRef.afterClosed().subscribe(() => {
            this._agentDialogRef = null;
            this.agentDialogBatch.set(null);
        });
    }

    closeAgentDialog(): void {
        this._agentDialogRef?.close();
    }

    saveAgentAssignment(): void {
        const row = this.agentDialogBatch();
        const batchId = row ? this.batchIdOf(row) : '';
        const agentUserId = this.agentForm.getRawValue().agentUserId;
        if (!batchId || !agentUserId) {
            return;
        }
        this.agentDialogSaving.set(true);
        this._admin
            .assignBatchAgent(batchId, agentUserId)
            .then(() => {
                this._notifyKey('admin.orderGroups.assignAgent.success');
                this.closeAgentDialog();
                this._load();
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.agentDialogSaving.set(false));
    }

    // ---- Presentation helpers --------------------------------------------

    /** Localized batch / member status label (raw value as fallback). */
    statusLabel(status: string | null | undefined): string {
        if (!status) {
            return '—';
        }
        const key = statusLabelKey(status);
        if (!key) {
            return String(status);
        }
        const label = this._transloco.translate(key);
        return label && label !== key ? label : String(status);
    }

    /** Start-of-day for a batch's date field, or null when missing/invalid. */
    private _batchDay(row: AdminOrderGroupRow): DateTime | null {
        const raw = row.createdAt ?? row['batchDate'];
        if (raw === null || raw === undefined || raw === '') {
            return null;
        }
        const parsed = DateTime.fromISO(String(raw));
        return parsed.isValid ? parsed.startOf('day') : null;
    }

    /** Locale date-time for a stored ISO value, or '' when missing/invalid. */
    formatDate(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleString(this._transloco.getActiveLang());
    }

    // ---- Data -------------------------------------------------------------

    private _load(): void {
        this._loadTask.trigger();
    }

    private readonly _loadTask = new CoalescedTask(async () => {
        this.loading.set(true);
        try {
            // Batches are cycle-scale — load the full set so mã-lô search /
            // filters work across every row, then paginate client-side.
            const pageSize = 100;
            const first = await this._admin.getOrderGroups(1, pageSize);
            const groups = [...first.groups];
            const total = first.totalCount;
            let page = 2;
            while (groups.length < total) {
                const next = await this._admin.getOrderGroups(page, pageSize);
                if (!next.groups.length) {
                    break;
                }
                groups.push(...next.groups);
                page += 1;
            }
            this.groups.set(groups);
            this.totalCount.set(groups.length);
        } catch {
            this.groups.set([]);
            this.totalCount.set(0);
        } finally {
            this.loading.set(false);
        }
        // Progress is a separate endpoint and a separate failure: the table is
        // still useful when only the progress strip could not be read, so it
        // just hides rather than taking the page down with it.
        try {
            this.progress.set(await this._admin.getOrderGroupProgress());
        } catch {
            this.progress.set(null);
        }
    });

    private _notifyKey(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    private async _notifyError(err: unknown): Promise<void> {
        const message = await describeApiError(
            err,
            (key) => this._transloco.translate(key),
            'admin.orderGroups.actionError'
        );
        this._snackBar.open(message, undefined, { duration: 5000 });
    }
}
