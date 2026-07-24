import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { AdminService } from '../admin.service';
import { AdminOrderGroupRow, AdminUserRow } from '../admin.types';
import { CoalescedTask } from '../shared/coalesced-task';
import { TableSort } from '../shared/table-sort';

/**
 * Admin ▸ Order groups — procurement batching (`/admin/order-groups`).
 *
 * Drives auto-batching (with a dry-run preview that the backend does not
 * persist), and per-batch manifest generation, agent assignment and
 * cancellation. Rows are untyped in the spec, so ids are read from either
 * `id` or `batchId` and every display field degrades to an em dash.
 */
@Component({
    selector: 'admin-order-groups',
    templateUrl: './order-groups.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    // Full-width flex host so the page fills the screen (see ResourceCrudComponent).
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        MatButtonModule,
        MatCheckboxModule,
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

    readonly groups = signal<AdminOrderGroupRow[]>([]);

    /**
     * Column sort. `GET /admin/order-groups` takes only `page`/`pageSize`, so
     * this orders the loaded page rather than the whole result set.
     */
    readonly sort = new TableSort<AdminOrderGroupRow>();

    /** {@link groups} in the active sort order. */
    readonly sortedGroups = computed(() =>
        this.sort.apply(this.groups(), (group, key) =>
            key === 'batch'
                ? group.batchNumber || this.batchIdOf(group)
                : (group[key] as string | number | null)
        )
    );
    readonly agents = signal<AdminUserRow[]>([]);
    readonly totalCount = signal(0);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(20);
    readonly loading = signal(false);
    readonly batching = signal(false);
    /** JSON preview returned by the last dry run, shown instead of a reload. */
    readonly dryRunResult = signal<string | null>(null);

    readonly batchForm = this._formBuilder.nonNullable.group({
        targetDate: [''],
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

    /** The batch's id. Normalised in the service, so `id` is authoritative. */
    batchIdOf(row: AdminOrderGroupRow): string {
        return row.id ?? '';
    }

    runAutoBatch(): void {
        const { targetDate, dryRun, force } = this.batchForm.getRawValue();
        this.batching.set(true);
        this.dryRunResult.set(null);
        this._admin
            .runAutoBatch({
                targetDate: targetDate || null,
                dryRun,
                force,
            })
            .then((result) => {
                if (dryRun) {
                    // A dry run persists nothing — show what it *would* do.
                    this.dryRunResult.set(JSON.stringify(result, null, 2));
                    this._notifyKey('admin.orderGroups.autoBatch.dryRunDone');
                    return;
                }
                this._notifyKey('admin.orderGroups.autoBatch.success');
                this._load();
            })
            .catch((err) => this._notifyError(err))
            .finally(() => this.batching.set(false));
    }

    generateManifest(row: AdminOrderGroupRow): void {
        const batchId = this.batchIdOf(row);
        if (!batchId) {
            return;
        }
        this._admin
            .generateManifest(batchId)
            .then(() => {
                this._notifyKey('admin.orderGroups.manifest.success');
                // Generating a manifest can advance the batch's status, which
                // the table renders — reload rather than assume it didn't.
                this._load();
            })
            .catch((err) => this._notifyError(err));
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
            .catch((err) => this._notifyError(err));
    }

    cancel(row: AdminOrderGroupRow): void {
        const batchId = this.batchIdOf(row);
        if (!batchId) {
            return;
        }
        this._admin
            .cancelOrderGroup(batchId)
            .then(() => {
                this._notifyKey('admin.orderGroups.cancel.success');
                this._load();
            })
            .catch((err) => this._notifyError(err));
    }

    /** Refreshes the list; overlapping calls collapse into one request. */
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
