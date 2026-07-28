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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
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
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import {
    ADMIN_DEFAULT_PAGE_SIZE,
    toApiPage,
    toPageIndex,
} from '../shared/admin-pagination';
import { CoalescedTask } from '../shared/coalesced-task';
import { TableSort } from '../shared/table-sort';

const DEFAULT_PAGE_SIZE = ADMIN_DEFAULT_PAGE_SIZE;
const RESTAURANT_ROLE = 'restaurant';

/**
 * Admin ▸ Restaurants — inventory list of `restaurant` users.
 * Detail view is a dedicated route.
 */
@Component({
    selector: 'admin-restaurants-admin',
    templateUrl: './restaurants-admin.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
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
    styles: [
        `
            .restaurants-grid {
                /* name | email | phone | status | details — fixed
                   action col so header and each row line up. */
                grid-template-columns:
                    minmax(0, 1.25fr) minmax(0, 1.5fr) minmax(0, 1fr)
                    7rem 5rem;
            }
        `,
    ],
})
export class RestaurantsAdminComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _destroyRef = inject(DestroyRef);

    readonly users = signal<AdminUserRow[]>([]);
    readonly sort = new TableSort<AdminUserRow>();
    readonly sortedUsers = computed(() =>
        this.sort.apply(this.users(), (user, key) =>
            key === 'status' ? user.isActive !== false : (user[key] as string)
        )
    );
    readonly totalCount = signal(0);
    readonly loading = signal(false);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(DEFAULT_PAGE_SIZE);

    readonly filterForm = this._formBuilder.nonNullable.group({
        search: [''],
        isActive: [''],
    });

    private readonly _filterValues = toSignal(this.filterForm.valueChanges, {
        initialValue: this.filterForm.getRawValue(),
    });

    readonly hasActiveFilters = computed(() => {
        const v = this._filterValues();
        return (v.search ?? '').trim() !== '' || !!(v.isActive ?? '');
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
        this.filterForm.reset({ search: '', isActive: '' });
    }

    openDetail(user: AdminUserRow): void {
        if (!user.id) {
            return;
        }
        void this._router.navigate(['/admin/restaurants', user.id], {
            state: { user },
        });
    }

    openCreatePanel(): void {
        void this._router.navigate(['/admin/restaurants/new']);
    }

    trackById(_: number, row: { id: string }): string {
        return row.id;
    }

    private _load(): void {
        this._loadTask.trigger();
    }

    private readonly _loadTask = new CoalescedTask(async () => {
        this.loading.set(true);
        const raw = this.filterForm.getRawValue();
        try {
            const result = await this._admin.getUsers({
                search: raw.search || undefined,
                role: RESTAURANT_ROLE,
                isActive:
                    raw.isActive === '' ? undefined : raw.isActive === 'true',
                page: toApiPage(this.pageIndex()),
                pageSize: this.pageSize(),
            });
            this.users.set(result.users);
            this.totalCount.set(result.totalCount);
            if (result.page) {
                this.pageIndex.set(toPageIndex(result.page));
            }
            if (result.pageSize) {
                this.pageSize.set(result.pageSize);
            }
        } catch {
            this.users.set([]);
            this.totalCount.set(0);
            this._snackBar.open(
                this._transloco.translate('admin.restaurants.loadError'),
                undefined,
                { duration: 5000 }
            );
        } finally {
            this.loading.set(false);
        }
    });
}
