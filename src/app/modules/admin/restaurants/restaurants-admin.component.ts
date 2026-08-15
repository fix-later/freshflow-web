import { NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnInit,
    ViewEncapsulation,
    computed,
    effect,
    inject,
    input,
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
import { describeApiError } from 'app/core/api/error-codes';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminService } from '../admin.service';
import { AdminUserRow, RESTAURANT_APPROVAL_STATUSES } from '../admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { ADMIN_DEFAULT_PAGE_SIZE } from '../shared/admin-pagination';
import { CoalescedTask } from '../shared/coalesced-task';
import { TableSort } from '../shared/table-sort';

const DEFAULT_PAGE_SIZE = ADMIN_DEFAULT_PAGE_SIZE;
const RESTAURANT_ROLE = 'restaurant';

function reviewStatusRank(user: AdminUserRow): number {
    const status = String(user.restaurantStatus ?? '')
        .trim()
        .toLowerCase();
    if (status === 'pending' || (!status && user.isApproved === false)) {
        return 0;
    }
    if (status === 'active' || (!status && user.isApproved === true)) {
        return 1;
    }
    if (status === 'suspended') {
        return 2;
    }
    return 3;
}

function createdTime(user: AdminUserRow): number {
    const time = Date.parse(String(user.createdAt ?? ''));
    return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/** Pending registrations first, newest registration first within each group. */
export function restaurantsForReview(
    users: readonly AdminUserRow[]
): AdminUserRow[] {
    return [...users].sort((left, right) => {
        const status = reviewStatusRank(left) - reviewStatusRank(right);
        return status || createdTime(right) - createdTime(left);
    });
}

/**
 * Admin ▸ Restaurants — inventory list of `restaurant` users.
 * Approval status and unlock belong here (BR-AUTH-1); detail is a dedicated route.
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
        NgTemplateOutlet,
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
                /* name | email | phone | status | approval | approve | unlock | account | details */
                grid-template-columns:
                    minmax(0, 1.25fr) minmax(0, 1.4fr) minmax(0, 0.9fr)
                    7rem minmax(0, 0.9fr) 7.5rem auto auto 5rem;
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

    /**
     * True when this list lives inside another page's tab (Admin ▸ Users ▸
     * restaurant). The whole header — title, search box, create button, and
     * every filter, approval included — then belongs to the host, which feeds
     * its values in through {@link search}, {@link isActive} and
     * {@link restaurantStatus}.
     */
    readonly embedded = input(false);
    readonly search = input('');
    readonly isActive = input('');
    readonly restaurantStatus = input('');

    readonly users = signal<AdminUserRow[]>([]);
    readonly sort = new TableSort<AdminUserRow>();
    readonly sortedUsers = computed(() => {
        if (!this.sort.key()) {
            return this.users();
        }
        return this.sort.apply(this.users(), (user, key) =>
            key === 'status' ? user.isActive !== false : (user[key] as string)
        );
    });
    readonly totalCount = signal(0);
    readonly loading = signal(false);
    readonly unlockingId = signal<string | null>(null);
    /** User id whose account activation call is in flight. */
    readonly accountStatusId = signal<string | null>(null);
    /** Restaurant id whose approval call is in flight, so only its row spins. */
    readonly approvingId = signal<string | null>(null);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(DEFAULT_PAGE_SIZE);
    readonly approvalStatuses = RESTAURANT_APPROVAL_STATUSES;

    readonly filterForm = this._formBuilder.nonNullable.group({
        search: [''],
        isActive: [''],
        restaurantStatus: [''],
    });

    private readonly _filterValues = toSignal(this.filterForm.valueChanges, {
        initialValue: this.filterForm.getRawValue(),
    });

    readonly hasActiveFilters = computed(() => {
        const v = this._filterValues();
        return (
            (v.search ?? '').trim() !== '' ||
            !!(v.isActive ?? '') ||
            !!(v.restaurantStatus ?? '')
        );
    });

    /**
     * Mirrors the host's filters into the form the reload pipeline already
     * watches, so a keystroke on the users page reaches this list through the
     * same debounce-and-refetch path as a local edit.
     */
    private readonly _hostFilters = effect(() => {
        if (!this.embedded()) {
            return;
        }
        this.filterForm.patchValue({
            search: this.search(),
            isActive: this.isActive(),
            restaurantStatus: this.restaurantStatus(),
        });
    });

    /** i18n key for a restaurant's approval lifecycle pill. */
    approvalKey(user: AdminUserRow): string {
        const status = String(user.restaurantStatus ?? '')
            .trim()
            .toLowerCase();
        if (status) {
            return `admin.users.approval.${status}`;
        }
        return user.isApproved
            ? 'admin.users.approval.active'
            : 'admin.users.approval.pending';
    }

    /**
     * A restaurant is approvable while it is still waiting for review.
     * Deliberately *not* keyed off `isActive`: the live API reports that as
     * `true` for every restaurant, pending ones included.
     */
    canApprove(user: AdminUserRow): boolean {
        return this.approvalKey(user).endsWith('.pending');
    }

    /**
     * Approve straight from the list — the common case is a queue of waiting
     * sign-ups, and opening each one just to approve it is a detour.
     */
    approve(user: AdminUserRow): void {
        const restaurantId = user.restaurantId;
        if (!restaurantId || this.approvingId()) {
            return;
        }
        this.approvingId.set(user.id);
        this._admin
            .approveRestaurant(restaurantId)
            .then(() => {
                // The endpoint moves `restaurantStatus`, never `isActive`.
                this.users.update((list) =>
                    restaurantsForReview(
                        list.map((row) =>
                            row.id === user.id
                                ? {
                                      ...row,
                                      isApproved: true,
                                      restaurantStatus: 'active',
                                  }
                                : row
                        )
                    )
                );
                this._snackBar.open(
                    this._transloco.translate(
                        'admin.restaurants.approve.success'
                    ),
                    undefined,
                    { duration: 5000 }
                );
            })
            .catch(async (err) => {
                this._snackBar.open(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.userDetail.actionError'
                    ),
                    undefined,
                    { duration: 5000 }
                );
            })
            .finally(() => this.approvingId.set(null));
    }

    approvalPillClass(user: AdminUserRow): string {
        const key = this.approvalKey(user);
        if (key.endsWith('.active')) {
            return 'admin-pill admin-pill-success';
        }
        if (key.endsWith('.suspended')) {
            return 'admin-pill admin-pill-danger';
        }
        return 'admin-pill admin-pill-warning';
    }

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
            search: '',
            isActive: '',
            restaurantStatus: '',
        });
    }

    unlock(user: AdminUserRow): void {
        if (!user.lockedUntil || this.unlockingId()) {
            return;
        }
        this.unlockingId.set(user.id);
        this._admin
            .unlockUser(user.id)
            .then(() => {
                this.users.update((list) =>
                    list.map((row) =>
                        row.id === user.id ? { ...row, lockedUntil: null } : row
                    )
                );
                this._snackBar.open(
                    this._transloco.translate('admin.users.unlock.success'),
                    undefined,
                    { duration: 5000 }
                );
            })
            .catch(async (err) => {
                this._snackBar.open(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.userDetail.actionError'
                    ),
                    undefined,
                    { duration: 5000 }
                );
            })
            .finally(() => this.unlockingId.set(null));
    }

    /**
     * Enables or disables login for the user account. This is deliberately
     * separate from the restaurant approval lifecycle: suspending a restaurant
     * controls whether it may operate, while this endpoint controls sign-in.
     */
    toggleAccountActive(user: AdminUserRow): void {
        if (this.accountStatusId()) {
            return;
        }
        const isActive = user.isActive === false;
        this.accountStatusId.set(user.id);
        this._admin
            .setUserActive(user.id, isActive)
            .then(() => {
                this.users.update((list) =>
                    list.map((row) =>
                        row.id === user.id ? { ...row, isActive } : row
                    )
                );
                this._snackBar.open(
                    this._transloco.translate(
                        isActive
                            ? 'admin.users.activate.success'
                            : 'admin.users.deactivate.success'
                    ),
                    undefined,
                    { duration: 5000 }
                );
            })
            .catch(async (err) => {
                this._snackBar.open(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.userDetail.actionError'
                    ),
                    undefined,
                    { duration: 5000 }
                );
            })
            .finally(() => this.accountStatusId.set(null));
    }

    openDetail(user: AdminUserRow): void {
        if (!user.id) {
            return;
        }
        void this._router.navigate(['/admin/restaurants', user.id], {
            state: { user },
        });
    }

    /**
     * Creating a restaurant is creating a user with that role, which the users
     * page's own button does — this list is a tab inside it.
     */
    openCreatePanel(): void {
        void this._router.navigate(['/admin/users']);
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
            const all = restaurantsForReview(
                await this._admin.listUsers({
                    search: raw.search || undefined,
                    role: RESTAURANT_ROLE,
                    isActive:
                        raw.isActive === ''
                            ? undefined
                            : raw.isActive === 'true',
                    restaurantStatus: raw.restaurantStatus || undefined,
                })
            );
            const pageSize = this.pageSize();
            const lastPage = Math.max(0, Math.ceil(all.length / pageSize) - 1);
            const pageIndex = Math.min(this.pageIndex(), lastPage);
            this.pageIndex.set(pageIndex);
            this.users.set(
                all.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
            );
            this.totalCount.set(all.length);
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
