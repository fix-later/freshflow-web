import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnInit,
    TemplateRef,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
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
import { describeApiError } from 'app/core/api/error-codes';
import { includesFolded } from 'app/core/util/text-search';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import {
    ADMIN_DEFAULT_PAGE_SIZE,
    ADMIN_PAGE_SIZE_OPTIONS,
} from '../shared/admin-pagination';
import { CrudRow } from '../shared/resource-crud.types';
import { TableSort } from '../shared/table-sort';
import { CatalogAdminService } from './catalog-admin.service';

/**
 * Admin ▸ Catalog ▸ Markets — list + agent dialog. Create and edit are
 * dedicated pages; pricing stays a separate routed screen.
 */
@Component({
    selector: 'admin-markets',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
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
    templateUrl: './markets.component.html',
    styles: [
        `
            .markets-grid {
                /* name | agent | details — fixed action cols so the
                   header and each row (separate grids) line up. */
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 5rem;

                @screen sm {
                    /* name | location | agent | details */
                    grid-template-columns:
                        minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)
                        5rem;
                }

                @screen md {
                    /* name | location | address | agent | details */
                    grid-template-columns:
                        minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.2fr)
                        minmax(10rem, 1fr) 5rem;
                }
            }
        `,
    ],
})
export class MarketsComponent implements OnInit {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _admin = inject(AdminService);
    private readonly _router = inject(Router);
    private readonly _dialog = inject(MatDialog);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _destroyRef = inject(DestroyRef);

    private _agentDialogRef: MatDialogRef<unknown> | null = null;

    readonly rows = signal<CrudRow[]>([]);
    /** marketId → assigned market_agent user */
    readonly agentsByMarket = signal<Map<string, AdminUserRow>>(new Map());
    readonly agentOptions = signal<AdminUserRow[]>([]);
    readonly agentDialogMarket = signal<CrudRow | null>(null);
    readonly agentDialogSaving = signal(false);
    readonly loading = signal(false);
    readonly search = signal('');
    readonly pageIndex = signal(0);
    readonly pageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    readonly pageSizeOptions = ADMIN_PAGE_SIZE_OPTIONS;
    readonly sort = new TableSort<CrudRow>();

    readonly agentForm = new FormGroup({
        agentUserId: new FormControl('', { nonNullable: true }),
    });

    readonly filteredRows = computed(() => {
        const term = this.search().trim();
        const list = this.rows();
        const agents = this.agentsByMarket();
        if (!term) {
            return list;
        }
        return list.filter((row) => {
            const agent = agents.get(row.id);
            const agentText = agent
                ? `${agent.email ?? ''} ${agent.name ?? ''}`
                : '';
            return (
                ['name', 'location', 'address'].some((key) =>
                    includesFolded(String(row[key] ?? ''), term)
                ) || includesFolded(agentText, term)
            );
        });
    });

    readonly sortedRows = computed(() =>
        this.sort.apply(this.filteredRows(), (row, key) => {
            if (key === 'agent') {
                const agent = this.agentsByMarket().get(row.id);
                return agent?.email ?? String(agent?.['name'] ?? '');
            }
            return String(row[key] ?? '');
        })
    );

    /** All markets after filter/sort — the backend has no offset pagination
     *  for this list, so the table paginates client-side from here. */
    readonly pagedRows = computed(() => {
        const start = this.pageIndex() * this.pageSize();
        return this.sortedRows().slice(start, start + this.pageSize());
    });

    readonly totalCount = computed(() => this.filteredRows().length);

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        Promise.all([
            this._catalog.listMarkets(),
            this._admin.getMarketAgentsWithAssignments().catch(() => ({
                agents: [] as AdminUserRow[],
                agentsByMarket: new Map<string, AdminUserRow>(),
            })),
        ])
            .then(([rows, { agents, agentsByMarket }]) => {
                this.rows.set(rows);
                this.agentOptions.set(agents);
                this.agentsByMarket.set(agentsByMarket);
            })
            .catch((err) => void this._notifyError(err, 'admin.crud.loadError'))
            .finally(() => this.loading.set(false));
    }

    agentFor(row: CrudRow): AdminUserRow | undefined {
        return this.agentsByMarket().get(row.id);
    }

    agentLabel(row: CrudRow): string {
        const agent = this.agentFor(row);
        if (!agent) {
            return '';
        }
        return agent.email || String(agent['name'] ?? '');
    }

    openAgentDialog(row: CrudRow, template: TemplateRef<unknown>): void {
        this.agentDialogMarket.set(row);
        const current = this.agentFor(row);
        this.agentForm.reset({ agentUserId: current?.id ?? '' });
        this.agentDialogSaving.set(false);

        this._agentDialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._agentDialogRef.afterClosed().subscribe(() => {
            this._agentDialogRef = null;
            this.agentDialogMarket.set(null);
        });
    }

    closeAgentDialog(): void {
        this._agentDialogRef?.close();
    }

    clearAgentAssignment(): void {
        this.agentForm.reset({ agentUserId: '' });
        this.saveAgentAssignment();
    }

    saveAgentAssignment(): void {
        const market = this.agentDialogMarket();
        if (!market) {
            return;
        }
        const agentUserId = this.agentForm.getRawValue().agentUserId || null;
        const previousAgentId = this.agentFor(market)?.id ?? null;

        this.agentDialogSaving.set(true);
        this._admin
            .setMarketAgent(market.id, agentUserId, previousAgentId)
            .then(() => {
                this._notify('admin.markets.agentDialog.success');
                this.closeAgentDialog();
                this.load();
            })
            .catch(
                (err) =>
                    void this._notifyError(
                        err,
                        'admin.markets.agentDialog.error'
                    )
            )
            .finally(() => this.agentDialogSaving.set(false));
    }

    onSearch(value: string): void {
        this.search.set(value);
        this.pageIndex.set(0);
    }

    onSort(key: string): void {
        this.sort.toggle(key);
        this.pageIndex.set(0);
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
    }

    /** Opens the dedicated market edit page. */
    openEdit(row: CrudRow): void {
        if (!row.id) {
            return;
        }
        void this._router.navigate(['/admin/markets', row.id], {
            state: { market: row },
        });
    }

    openCreate(): void {
        void this._router.navigate(['/admin/markets/new']);
    }

    isInactive(row: CrudRow): boolean {
        return row.isActive === false;
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    private async _notifyError(
        err: unknown,
        fallbackKey: string
    ): Promise<void> {
        const message = await describeApiError(
            err,
            (key) => this._transloco.translate(key),
            fallbackKey
        );
        this._snackBar.open(message, undefined, { duration: 5000 });
    }
}
