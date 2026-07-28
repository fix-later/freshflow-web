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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
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

type RestaurantAction = 'approve' | 'settle';

/**
 * Admin ▸ Restaurants — inventory list of `restaurant` users.
 * Row actions: approve, settle. Detail view is a dedicated route.
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
    styles: [
        `
            .restaurants-grid {
                grid-template-columns:
                    minmax(0, 1.25fr) minmax(0, 1.5fr) minmax(0, 1fr)
                    minmax(0, 0.9fr) auto auto;
            }
        `,
    ],
})
export class RestaurantsAdminComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _dialog = inject(MatDialog);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _destroyRef = inject(DestroyRef);

    private _dialogRef: MatDialogRef<unknown> | null = null;

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

    /** Which row + API action is currently in flight. */
    readonly busyAction = signal<{
        userId: string;
        kind: RestaurantAction;
    } | null>(null);

    /** User targeted by the settle dialog. */
    readonly actionUser = signal<AdminUserRow | null>(null);

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

    readonly settleForm = this._formBuilder.nonNullable.group({
        amount: [0, []],
        paymentMethod: [''],
        reference: [''],
        note: [''],
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

    isActionBusy(user: AdminUserRow, kind: RestaurantAction): boolean {
        const busy = this.busyAction();
        return !!busy && busy.userId === user.id && busy.kind === kind;
    }

    anyActionBusy(user: AdminUserRow): boolean {
        const busy = this.busyAction();
        return !!busy && busy.userId === user.id;
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

    approve(user: AdminUserRow): void {
        const restaurantId = user.restaurantId;
        if (!restaurantId) {
            this._notify('admin.restaurants.noRestaurantId');
            return;
        }
        this.busyAction.set({ userId: user.id, kind: 'approve' });
        this._admin
            .approveRestaurant(restaurantId)
            .then(() => this._notify('admin.restaurants.approve.success'))
            .catch((err) => void this._notifyError(err))
            .finally(() => this.busyAction.set(null));
    }

    openSettleDialog(user: AdminUserRow, template: TemplateRef<unknown>): void {
        if (!user.restaurantId) {
            this._notify('admin.restaurants.noRestaurantId');
            return;
        }
        if (this._dialogRef) {
            return;
        }
        this.actionUser.set(user);
        this.settleForm.reset({
            amount: 0,
            paymentMethod: '',
            reference: '',
            note: '',
        });
        this._dialogRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._dialogRef.afterClosed().subscribe(() => {
            this._dialogRef = null;
            this.actionUser.set(null);
        });
    }

    closeActionDialog(): void {
        this._dialogRef?.close();
    }

    settleCredit(): void {
        const user = this.actionUser();
        const restaurantId = user?.restaurantId;
        if (!user || !restaurantId || this.settleForm.invalid) {
            this.settleForm.markAllAsTouched();
            return;
        }
        const { amount, paymentMethod, reference, note } =
            this.settleForm.getRawValue();
        if (!amount || amount < 0.01) {
            this.settleForm.controls.amount.setErrors({ min: true });
            this.settleForm.markAllAsTouched();
            return;
        }
        this.busyAction.set({ userId: user.id, kind: 'settle' });
        this._admin
            .settleCredit(restaurantId, {
                amount,
                paymentMethod: paymentMethod || null,
                reference: reference || null,
                note: note || null,
            })
            .then(() => {
                this._notify('admin.restaurants.settle.success');
                this.closeActionDialog();
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.busyAction.set(null));
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
            this._notify('admin.restaurants.loadError');
        } finally {
            this.loading.set(false);
        }
    });

    private _notify(key: string): void {
        this._notifyText(this._transloco.translate(key));
    }

    private _notifyText(message: string): void {
        this._snackBar.open(message, undefined, { duration: 5000 });
    }

    private async _notifyError(err: unknown): Promise<void> {
        this._notifyText(
            await describeApiError(
                err,
                (key) => this._transloco.translate(key),
                'admin.restaurants.actionError'
            )
        );
    }
}
