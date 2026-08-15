import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    input,
    signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DateTime } from 'luxon';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminService } from '../admin.service';
import { AdminAuditLogRow } from '../admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import {
    ADMIN_DEFAULT_PAGE_SIZE,
    toApiPage,
    toPageIndex,
} from '../shared/admin-pagination';
import { CoalescedTask } from '../shared/coalesced-task';
import { TableSort } from '../shared/table-sort';

/**
 * Admin ▸ Audit logs — read-only, filterable list of the platform audit trail
 * (`GET /admin/audit-logs`). Filters map straight to the query string (actor,
 * action, entity type, date range) and drive server-side pagination.
 */
@Component({
    selector: 'admin-audit-logs',
    templateUrl: './audit-logs.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatDatepickerModule,
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
    styles: [
        `
            .audit-logs-grid {
                /* time | actor | action | entity */
                grid-template-columns:
                    minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr)
                    minmax(0, 1.4fr);

                @screen md {
                    /* + entity id */
                    grid-template-columns:
                        minmax(0, 0.9fr) minmax(0, 1.2fr) minmax(0, 1fr)
                        minmax(0, 1fr) minmax(0, 1.2fr);
                }
            }
        `,
    ],
})
export class AuditLogsComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _destroyRef = inject(DestroyRef);

    /**
     * True when the dashboard's tab bar already names this section — the log
     * then drops its own page title and renders from the filters down.
     */
    readonly embedded = input(false);

    readonly entries = signal<AdminAuditLogRow[]>([]);
    readonly totalCount = signal(0);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    readonly loading = signal(false);

    readonly sort = new TableSort<AdminAuditLogRow>();
    readonly sortedEntries = computed(() =>
        this.sort.apply(this.entries(), (entry, key) =>
            key === 'time'
                ? this.timeOf(entry)
                : (entry[key] as string | number | null)
        )
    );

    readonly filterForm = this._formBuilder.nonNullable.group({
        action: [''],
        entityType: [''],
        actorId: [''],
        from: this._formBuilder.control<DateTime | null>(null),
        to: this._formBuilder.control<DateTime | null>(null),
    });

    private readonly _filterValues = toSignal(this.filterForm.valueChanges, {
        initialValue: this.filterForm.getRawValue(),
    });

    readonly hasActiveFilters = computed(() => {
        const v = this._filterValues();
        return (
            (v.action ?? '').trim() !== '' ||
            (v.entityType ?? '').trim() !== '' ||
            (v.actorId ?? '').trim() !== '' ||
            !!v.from ||
            !!v.to
        );
    });

    ngOnInit(): void {
        this._load();
        this.filterForm.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged(
                    (a, b) => JSON.stringify(a) === JSON.stringify(b)
                ),
                takeUntilDestroyed(this._destroyRef)
            )
            .subscribe(() => {
                this.pageIndex.set(0);
                this._load();
            });
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
        this._load();
    }

    clearFilters(): void {
        this.filterForm.reset({
            action: '',
            entityType: '',
            actorId: '',
            from: null,
            to: null,
        });
    }

    trackById(index: number, row: AdminAuditLogRow): string {
        return row.id || String(index);
    }

    /** Actor label — email preferred, id fallback, dash when unknown. */
    actorOf(row: AdminAuditLogRow): string {
        return row.actorEmail || row.actorId || '—';
    }

    /** ISO timestamp of the entry (either of the two keys the backend uses). */
    timeOf(row: AdminAuditLogRow): string {
        return String(row.timestamp ?? row.createdAt ?? '');
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

    private _load(): void {
        this._loadTask.trigger();
    }

    private readonly _loadTask = new CoalescedTask(async () => {
        this.loading.set(true);
        const raw = this.filterForm.getRawValue();
        try {
            const result = await this._admin.getAuditLogs({
                action: raw.action.trim() || undefined,
                entityType: raw.entityType.trim() || undefined,
                actorId: raw.actorId.trim() || undefined,
                from: this._isoDate(raw.from),
                to: this._isoDate(raw.to),
                page: toApiPage(this.pageIndex()),
                pageSize: this.pageSize(),
            });
            this.entries.set(result.entries);
            this.totalCount.set(result.totalCount);
            if (result.page) {
                this.pageIndex.set(toPageIndex(result.page));
            }
            if (result.pageSize) {
                this.pageSize.set(result.pageSize);
            }
        } catch {
            this.entries.set([]);
            this.totalCount.set(0);
            this._notify('admin.auditLogs.loadError');
        } finally {
            this.loading.set(false);
        }
    });

    private _isoDate(value: DateTime | null): string | undefined {
        return value && DateTime.isDateTime(value) && value.isValid
            ? value.toISODate() ?? undefined
            : undefined;
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 5000,
        });
    }
}
