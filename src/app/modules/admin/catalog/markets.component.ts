import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
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
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import {
    ADMIN_DEFAULT_PAGE_SIZE,
    ADMIN_PAGE_SIZE_OPTIONS,
} from '../shared/admin-pagination';
import { CrudRow } from '../shared/resource-crud.types';
import { TableSort } from '../shared/table-sort';
import { CatalogAdminService } from './catalog-admin.service';

/**
 * Admin ▸ Catalog ▸ Markets — the list. Create and edit are dedicated pages,
 * and that is where a market's people are assigned: the agent roster is a
 * multi-select on the detail page, which has room to show every name.
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
                /* market (thumb + name) | hubs | details — fixed action col so
                   the header and each row (separate grids) line up. */
                grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) 5rem;

                @screen sm {
                    /* market | location | hubs | details */
                    grid-template-columns:
                        minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)
                        5rem;
                }

                @screen md {
                    /* market | location | address | hubs | details */
                    grid-template-columns:
                        minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1.2fr)
                        minmax(0, 1.2fr) 5rem;
                }
            }

            /* Fixed thumbnail box, so rows keep one height whether or not a
               market has a picture. */
            .markets-grid .market-thumb {
                width: 2.75rem;
                height: 2.75rem;
                flex: 0 0 auto;
                border-radius: 0.5rem;
                object-fit: cover;
            }
        `,
    ],
})
export class MarketsComponent implements OnInit {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _destroyRef = inject(DestroyRef);

    readonly rows = signal<CrudRow[]>([]);
    /** marketId → its hubs' names. Agents live on the detail page now. */
    readonly hubsByMarket = signal<Map<string, string[]>>(new Map());
    readonly loading = signal(false);
    readonly search = signal('');
    readonly pageIndex = signal(0);
    readonly pageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    readonly pageSizeOptions = ADMIN_PAGE_SIZE_OPTIONS;
    readonly sort = new TableSort<CrudRow>();

    readonly filteredRows = computed(() => {
        const term = this.search().trim();
        const list = this.rows();
        if (!term) {
            return list;
        }
        return list.filter(
            (row) =>
                ['name', 'location', 'address'].some((key) =>
                    includesFolded(String(row[key] ?? ''), term)
                ) || includesFolded(this.hubLabel(row), term)
        );
    });

    readonly sortedRows = computed(() =>
        this.sort.apply(this.filteredRows(), (row, key) => {
            if (key === 'hubs') {
                return this.hubLabel(row);
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
            this._logistics.listHubs().catch(() => [] as CrudRow[]),
        ])
            .then(([rows, hubs]) => {
                this.rows.set(rows);
                const byMarket = new Map<string, string[]>();
                for (const hub of hubs) {
                    const marketId = String(hub['marketId'] ?? '');
                    if (!marketId) {
                        continue;
                    }
                    byMarket.set(marketId, [
                        ...(byMarket.get(marketId) ?? []),
                        String(hub['name'] ?? '').trim() || hub.id,
                    ]);
                }
                this.hubsByMarket.set(byMarket);
            })
            .catch((err) => void this._notifyError(err, 'admin.crud.loadError'))
            .finally(() => this.loading.set(false));
    }

    /** Every hub of the market — all of them, not just the first. */
    hubsFor(row: CrudRow): string[] {
        return this.hubsByMarket().get(row.id) ?? [];
    }

    /** The hub names as one string — the search text and the sort key. */
    hubLabel(row: CrudRow): string {
        return this.hubsFor(row).join(', ');
    }

    imageUrl(row: CrudRow): string {
        return String(row['imageUrl'] ?? '');
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
