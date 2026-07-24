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
    ReactiveFormsModule,
    ValidationErrors,
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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { readApiError } from 'app/core/api/envelope';
import { describeApiError } from 'app/core/api/error-codes';
import { includesFolded } from 'app/core/util/text-search';
import { DateTime } from 'luxon';
import { AdminService } from '../admin.service';
import {
    AdminAutoBatchResult,
    AdminOrderGroupRow,
    AdminUserRow,
} from '../admin.types';
import { AdminSettingsDialogComponent } from '../settings/settings.component';
import {
    ADMIN_DEFAULT_PAGE_SIZE,
    toApiPage,
    toPageIndex,
} from '../shared/admin-pagination';
import { CoalescedTask } from '../shared/coalesced-task';
import { TableSort } from '../shared/table-sort';

/** Reason codes the auto-batch run reports for skipped orders (see doc §4.2). */
const KNOWN_SKIP_REASONS = new Set([
    'ALREADY_BATCHED',
    'NOT_CONFIRMED',
    'CANCELLED',
    'OUT_OF_STOCK',
    'NO_ELIGIBLE_ITEMS',
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
                /* batch | market | status | agent | actions */
                grid-template-columns:
                    minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.9fr)
                    minmax(0, 1.3fr) auto;

                @screen md {
                    /* + orders */
                    grid-template-columns:
                        minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 0.9fr)
                        minmax(0, 0.55fr) minmax(0, 1.3fr) auto;
                }

                @screen lg {
                    /* + created */
                    grid-template-columns:
                        minmax(0, 1.1fr) minmax(0, 1.2fr) minmax(0, 0.9fr)
                        minmax(0, 0.55fr) minmax(0, 1fr) minmax(0, 1.3fr) auto;
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

    private _cancelDialogRef: MatDialogRef<unknown> | null = null;
    private _batchDialogRef: MatDialogRef<unknown> | null = null;
    private _settingsDialogRef: MatDialogRef<AdminSettingsDialogComponent> | null =
        null;

    readonly groups = signal<AdminOrderGroupRow[]>([]);
    readonly agents = signal<AdminUserRow[]>([]);
    readonly totalCount = signal(0);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    readonly loading = signal(false);
    readonly batching = signal(false);
    readonly search = signal('');

    /** Structured result of the last auto-batch run (dry or applied). */
    readonly autoBatchResult = signal<AdminAutoBatchResult | null>(null);
    /** Explained failure of the last auto-batch run, shown as a banner. */
    readonly autoBatchError = signal<{
        message: string;
        severity: 'error' | 'warning';
    } | null>(null);

    /** Row targeted by the cancel dialog. */
    readonly cancelTarget = signal<AdminOrderGroupRow | null>(null);
    readonly cancelSaving = signal(false);
    readonly cancelReason = new FormControl('', { nonNullable: true });

    readonly sort = new TableSort<AdminOrderGroupRow>();

    readonly filteredGroups = computed(() => {
        const term = this.search().trim();
        const list = this.groups();
        if (!term) {
            return list;
        }
        return list.filter((group) => {
            const batch = group.batchNumber || this.batchIdOf(group);
            return (
                includesFolded(String(batch ?? ''), term) ||
                includesFolded(String(group.marketName ?? ''), term) ||
                includesFolded(String(group.status ?? ''), term) ||
                includesFolded(String(group.agentEmail ?? ''), term)
            );
        });
    });

    readonly sortedGroups = computed(() =>
        this.sort.apply(this.filteredGroups(), (group, key) =>
            key === 'batch'
                ? group.batchNumber || this.batchIdOf(group)
                : (group[key] as string | number | null)
        )
    );

    readonly batchForm = this._formBuilder.group({
        targetDate: this._formBuilder.control<DateTime | null>(null, {
            validators: [validTargetDate],
        }),
        dryRun: this._formBuilder.nonNullable.control(true),
        force: this._formBuilder.nonNullable.control(false),
    });

    ngOnInit(): void {
        this._load();
        this._admin
            .getAgentOptions()
            .then((agents) => this.agents.set(agents))
            .catch(() => this.agents.set([]));
    }

    onSearch(value: string): void {
        this.search.set(value);
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
        this._load();
    }

    trackById(index: number, row: AdminOrderGroupRow): string {
        return this.batchIdOf(row) || String(index);
    }

    batchIdOf(row: AdminOrderGroupRow): string {
        return row.id ?? '';
    }

    // ---- Auto-batch -------------------------------------------------------

    openSettings(): void {
        if (this._settingsDialogRef) {
            return;
        }
        this._settingsDialogRef = this._dialog.open(
            AdminSettingsDialogComponent,
            {
                autoFocus: 'first-tabbable',
                width: '40rem',
                maxWidth: '95vw',
            }
        );
        this._settingsDialogRef.afterClosed().subscribe(() => {
            this._settingsDialogRef = null;
        });
    }

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

    /** Localized label for a skipped-order reason code (raw code as fallback). */
    skippedReasonLabel(reason: string | null | undefined): string {
        if (!reason) {
            return '—';
        }
        return KNOWN_SKIP_REASONS.has(reason)
            ? this._transloco.translate(
                  'admin.orderGroups.skipReason.' + reason
              )
            : reason;
    }

    /** Turns an auto-batch failure into an explained, localized banner. */
    private async _handleAutoBatchError(err: unknown): Promise<void> {
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
            this.batchForm.controls.targetDate.setErrors({ server: true });
        }
        this.autoBatchError.set({
            message,
            severity: alreadyRunning ? 'warning' : 'error',
        });
    }

    // ---- Row actions ------------------------------------------------------

    generateManifest(row: AdminOrderGroupRow): void {
        const batchId = this.batchIdOf(row);
        if (!batchId) {
            return;
        }
        this._admin
            .generateManifest(batchId)
            .then(() => {
                this._notifyKey('admin.orderGroups.manifest.success');
                this._load();
            })
            .catch((err) => void this._notifyError(err));
    }

    assignAgent(row: AdminOrderGroupRow, agentUserId: string): void {
        const batchId = this.batchIdOf(row);
        if (!batchId || !agentUserId) {
            return;
        }
        this._admin
            .assignBatchAgent(batchId, agentUserId)
            .then(() => {
                this._notifyKey('admin.orderGroups.assignAgent.success');
                this._load();
            })
            .catch((err) => void this._notifyError(err));
    }

    openCancel(row: AdminOrderGroupRow, template: TemplateRef<unknown>): void {
        this.cancelTarget.set(row);
        this.cancelReason.reset('');
        this.cancelSaving.set(false);
        this._cancelDialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._cancelDialogRef.afterClosed().subscribe(() => {
            this._cancelDialogRef = null;
            this.cancelTarget.set(null);
        });
    }

    closeCancel(): void {
        this._cancelDialogRef?.close();
    }

    confirmCancel(): void {
        const row = this.cancelTarget();
        const batchId = row ? this.batchIdOf(row) : '';
        if (!batchId) {
            return;
        }
        this.cancelSaving.set(true);
        this._admin
            .cancelOrderGroup(
                batchId,
                this.cancelReason.value.trim() || undefined
            )
            .then(() => {
                this._notifyKey('admin.orderGroups.cancel.success');
                this.closeCancel();
                this._load();
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.cancelSaving.set(false));
    }

    // ---- Presentation helpers --------------------------------------------

    /** Pill class for a batch status (falls back to a neutral chip). */
    statusPillClass(status: string | null | undefined): string {
        switch (String(status ?? '').toLowerCase()) {
            case 'completed':
            case 'dispatched':
                return 'admin-pill admin-pill-success';
            case 'open':
            case 'locked':
            case 'processing':
                return 'admin-pill admin-pill-warning';
            default:
                return 'admin-pill admin-pill-neutral';
        }
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
            const { groups, totalCount, page, pageSize } =
                await this._admin.getOrderGroups(
                    toApiPage(this.pageIndex()),
                    this.pageSize()
                );
            this.groups.set(groups);
            this.totalCount.set(totalCount);
            if (page) {
                this.pageIndex.set(toPageIndex(page));
            }
            if (pageSize) {
                this.pageSize.set(pageSize);
            }
        } catch {
            this.groups.set([]);
            this.totalCount.set(0);
        } finally {
            this.loading.set(false);
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
