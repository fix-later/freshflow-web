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
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
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
import { collapseOnLeave, expandOnEnter } from '@fuse/animations';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { LocationPickerComponent } from 'app/core/maps/location-picker.component';
import { includesFolded } from 'app/core/util/text-search';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';
import {
    ADMIN_DEFAULT_PAGE_SIZE,
    ADMIN_PAGE_SIZE_OPTIONS,
    toApiPage,
    toPageIndex,
} from '../shared/admin-pagination';
import { CrudRow } from '../shared/resource-crud.types';
import { TableSort } from '../shared/table-sort';
import { CatalogAdminService } from './catalog-admin.service';

/**
 * Admin ▸ Catalog ▸ Markets — inventory-style list with inline detail editor
 * (Fuse ecommerce inventory pattern). Row actions column is omitted; edit /
 * deactivate / pricing live in the expanded detail panel.
 */
@Component({
    selector: 'admin-markets',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
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
        LocationPickerComponent,
    ],
    templateUrl: './markets.component.html',
    styles: [
        `
            .markets-grid {
                /* name | agent | pricing | details — fixed action cols so the
                   header and each row (separate grids) line up. */
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 7rem 5rem;

                @screen sm {
                    /* name | location | agent | pricing | details */
                    grid-template-columns:
                        minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)
                        7rem 5rem;
                }

                @screen md {
                    /* name | location | address | agent | pricing | details */
                    grid-template-columns:
                        minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.2fr)
                        minmax(10rem, 1fr) 7rem 5rem;
                }
            }
        `,
    ],
})
export class MarketsComponent implements OnInit {
    protected readonly expandOnEnter = expandOnEnter;
    protected readonly collapseOnLeave = collapseOnLeave;

    private readonly _catalog = inject(CatalogAdminService);
    private readonly _admin = inject(AdminService);
    private readonly _router = inject(Router);
    private readonly _dialog = inject(MatDialog);
    private readonly _confirmation = inject(FuseConfirmationService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    private _createDialogRef: MatDialogRef<unknown> | null = null;
    private _agentDialogRef: MatDialogRef<unknown> | null = null;

    readonly rows = signal<CrudRow[]>([]);
    /** marketId → assigned market_agent user */
    readonly agentsByMarket = signal<Map<string, AdminUserRow>>(new Map());
    readonly agentOptions = signal<AdminUserRow[]>([]);
    readonly agentDialogMarket = signal<CrudRow | null>(null);
    readonly agentDialogSaving = signal(false);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly search = signal('');
    readonly pageIndex = signal(0);
    readonly pageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    readonly totalCount = signal(0);
    readonly pageSizeOptions = ADMIN_PAGE_SIZE_OPTIONS;
    readonly selectedId = signal<string | null>(null);
    readonly flashMessage = signal<'success' | 'error' | null>(null);
    readonly sort = new TableSort<CrudRow>();

    readonly agentForm = new FormGroup({
        agentUserId: new FormControl('', { nonNullable: true }),
    });

    readonly selectedForm = new FormGroup({
        name: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        location: new FormControl('', { nonNullable: true }),
        address: new FormControl('', { nonNullable: true }),
        latitude: new FormControl<number | null>(null),
        longitude: new FormControl<number | null>(null),
    });

    readonly createForm = new FormGroup({
        name: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        location: new FormControl('', { nonNullable: true }),
        address: new FormControl('', { nonNullable: true }),
        latitude: new FormControl<number | null>(null),
        longitude: new FormControl<number | null>(null),
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

    readonly pagedRows = computed(() => this.sortedRows());

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        Promise.all([
            this._catalog.listMarketsPage({
                page: toApiPage(this.pageIndex()),
                pageSize: this.pageSize(),
                activeOnly: false,
            }),
            this._admin.getMarketAgentsWithAssignments().catch(() => ({
                agents: [] as AdminUserRow[],
                agentsByMarket: new Map<string, AdminUserRow>(),
            })),
        ])
            .then(([page, { agents, agentsByMarket }]) => {
                this.rows.set(page.rows);
                this.totalCount.set(page.total);
                if (page.page) {
                    this.pageIndex.set(toPageIndex(page.page));
                }
                if (page.pageSize) {
                    this.pageSize.set(page.pageSize);
                }
                this.agentOptions.set(agents);
                this.agentsByMarket.set(agentsByMarket);
                const id = this.selectedId();
                if (id && !page.rows.some((r) => r.id === id)) {
                    this.closeDetails();
                } else if (id) {
                    const row = page.rows.find((r) => r.id === id);
                    if (row) {
                        this._patchSelected(row);
                    }
                }
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
                // Same fetch as initial page load: markets + market agents.
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
        this.closeDetails();
    }

    onSort(key: string): void {
        this.sort.toggle(key);
        this.pageIndex.set(0);
        this.closeDetails();
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
        this.closeDetails();
        this.load();
    }

    toggleDetails(row: CrudRow): void {
        if (this.selectedId() === row.id) {
            this.closeDetails();
            return;
        }
        this.selectedId.set(row.id);
        this.flashMessage.set(null);
        this._patchSelected(row);
    }

    closeDetails(): void {
        this.selectedId.set(null);
        this.flashMessage.set(null);
        this.selectedForm.reset({
            name: '',
            location: '',
            address: '',
            latitude: null,
            longitude: null,
        });
    }

    openCreate(template: TemplateRef<unknown>): void {
        this.createForm.reset({
            name: '',
            location: '',
            address: '',
            latitude: null,
            longitude: null,
        });
        this._createDialogRef = this._dialog.open(template, {
            width: '560px',
            maxWidth: '95vw',
            autoFocus: 'first-tabbable',
        });
    }

    closeCreate(): void {
        this._createDialogRef?.close();
        this._createDialogRef = null;
    }

    saveCreate(): void {
        if (this.createForm.invalid) {
            this.createForm.markAllAsTouched();
            return;
        }
        this.saving.set(true);
        this._catalog
            .createMarket(this.createForm.getRawValue())
            .then(() => {
                this._notify('admin.crud.createSuccess');
                this.closeCreate();
                this.load();
            })
            .catch((err) => void this._notifyError(err, 'admin.crud.saveError'))
            .finally(() => this.saving.set(false));
    }

    updateSelected(): void {
        const id = this.selectedId();
        if (!id || this.selectedForm.invalid) {
            this.selectedForm.markAllAsTouched();
            return;
        }
        this.saving.set(true);
        this._catalog
            .updateMarket(id, this.selectedForm.getRawValue())
            .then(() => {
                this.showFlashMessage('success');
                this.load();
            })
            .catch((err) => {
                this.showFlashMessage('error');
                void this._notifyError(err, 'admin.crud.saveError');
            })
            .finally(() => this.saving.set(false));
    }

    deactivateSelected(): void {
        const id = this.selectedId();
        if (!id) {
            return;
        }
        const row = this.rows().find((r) => r.id === id);
        if (row?.isActive === false) {
            return;
        }

        const confirmation = this._confirmation.open({
            title: this._transloco.translate('admin.crud.confirmRemove.title'),
            message: this._transloco.translate(
                'admin.crud.confirmRemove.message'
            ),
            actions: {
                confirm: {
                    label: this._transloco.translate('admin.crud.deactivate'),
                },
            },
        });

        confirmation.afterClosed().subscribe((result) => {
            if (result !== 'confirmed') {
                return;
            }
            this.saving.set(true);
            this._catalog
                .deactivateMarket(id)
                .then(() => {
                    this._notify('admin.crud.removeSuccess');
                    this.closeDetails();
                    this.load();
                })
                .catch(
                    (err) => void this._notifyError(err, 'admin.crud.saveError')
                )
                .finally(() => this.saving.set(false));
        });
    }

    openPricing(row: CrudRow): void {
        void this._router.navigate(['/admin/markets', row.id, 'products']);
    }

    isInactive(row: CrudRow): boolean {
        return row.isActive === false;
    }

    showFlashMessage(type: 'success' | 'error'): void {
        this.flashMessage.set(type);
        window.setTimeout(() => {
            if (this.flashMessage() === type) {
                this.flashMessage.set(null);
            }
        }, 3000);
    }

    private _patchSelected(row: CrudRow): void {
        this.selectedForm.reset({
            name: String(row['name'] ?? ''),
            location: String(row['location'] ?? ''),
            address: String(row['address'] ?? ''),
            latitude:
                row['latitude'] == null || row['latitude'] === ''
                    ? null
                    : Number(row['latitude']),
            longitude:
                row['longitude'] == null || row['longitude'] === ''
                    ? null
                    : Number(row['longitude']),
        });
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
