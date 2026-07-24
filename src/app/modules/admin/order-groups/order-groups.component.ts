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
import { AdminService } from '../admin.service';
import {
    AdminAutoBatchResult,
    AdminOrderGroupRow,
    AdminUserRow,
} from '../admin.types';
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

/** Optional `yyyy-MM-dd` date — mirrors the backend's `targetDate` validation. */
function validTargetDate(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '').trim();
    if (!value) {
        return null;
    }
    const ok =
        /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
    return ok ? null : { invalidDate: true };
}

/**
 * Admin ▸ Order groups — procurement batching (`/admin/order-groups`).
 *
 * Validates the auto-batch inputs client-side (mirroring the backend rules)
 * before sending, renders the run result as UI (created / batched / skipped
 * with per-order reasons) instead of raw JSON, and turns every documented
 * failure code into an explained banner or snackbar so the admin always knows
 * what happened. Per-batch manifest, agent assignment and cancellation are
 * handled the same way.
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
        MatCheckboxModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class OrderGroupsComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _dialog = inject(MatDialog);

    private _cancelDialogRef: MatDialogRef<unknown> | null = null;

    readonly groups = signal<AdminOrderGroupRow[]>([]);
    readonly agents = signal<AdminUserRow[]>([]);
    readonly totalCount = signal(0);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(20);
    readonly loading = signal(false);
    readonly batching = signal(false);

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
    readonly sortedGroups = computed(() =>
        this.sort.apply(this.groups(), (group, key) =>
            key === 'batch'
                ? group.batchNumber || this.batchIdOf(group)
                : (group[key] as string | number | null)
        )
    );

    readonly batchForm = this._formBuilder.nonNullable.group({
        targetDate: ['', [validTargetDate]],
        dryRun: [true],
        force: [false],
    });

    ngOnInit(): void {
        this._load();
        this._admin
            .getAgentOptions()
            .then((agents) => this.agents.set(agents))
            .catch(() => this.agents.set([]));
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

    runAutoBatch(): void {
        if (this.batchForm.invalid) {
            this.batchForm.markAllAsTouched();
            return;
        }
        const { targetDate, dryRun, force } = this.batchForm.getRawValue();
        this.batching.set(true);
        this.autoBatchResult.set(null);
        this.autoBatchError.set(null);
        this._admin
            .runAutoBatch({ targetDate: targetDate || null, dryRun, force })
            .then((result) => {
                this.autoBatchResult.set(result);
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
        // agentUserId is required by the backend — don't send an empty pick.
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
            width: '440px',
            maxWidth: '95vw',
            autoFocus: 'first-tabbable',
        });
    }

    closeCancel(): void {
        this._cancelDialogRef?.close();
        this._cancelDialogRef = null;
        this.cancelTarget.set(null);
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
            const { groups, totalCount } = await this._admin.getOrderGroups(
                this.pageIndex() + 1,
                this.pageSize()
            );
            this.groups.set(groups);
            this.totalCount.set(totalCount);
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
