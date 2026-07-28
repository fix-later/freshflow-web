import { DecimalPipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnInit,
    TemplateRef,
    ViewChild,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
    FormBuilder,
    FormGroupDirective,
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
import { ActivatedRoute, Router } from '@angular/router';
import { collapseOnLeave, expandOnEnter } from '@fuse/animations';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    EMAIL_MAX_LENGTH,
    passwordStrengthValidator,
    phoneNumberValidator,
} from 'app/core/api/validators';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminService } from '../admin.service';
import {
    AdminCreditStatement,
    AdminCreditTransaction,
    AdminRestaurantCredit,
    AdminUserRow,
} from '../admin.types';
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
const RESTAURANT_NAME_MAX_LENGTH = 200;
const PHONE_MAX_LENGTH = 20;

type RestaurantAction =
    | 'approve'
    | 'suspend'
    | 'reactivate'
    | 'creditLimit'
    | 'settle';

/**
 * Admin ▸ Restaurants — inventory list of `restaurant` users.
 * Row actions map 1:1 to admin restaurant APIs (approve / suspend /
 * reactivate / credit limit / settle). Detail panel is profile + credit snapshot.
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
        DecimalPipe,
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
    protected readonly expandOnEnter = expandOnEnter;
    protected readonly collapseOnLeave = collapseOnLeave;

    @ViewChild('createRestaurantPanel')
    private _createPanel!: TemplateRef<unknown>;

    private readonly _admin = inject(AdminService);
    private readonly _dialog = inject(MatDialog);
    private readonly _route = inject(ActivatedRoute);
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

    readonly selectedId = signal<string | null>(null);
    readonly credit = signal<AdminRestaurantCredit | null>(null);
    readonly loadingCredit = signal(false);

    /** Credit ledger + monthly statements for the expanded restaurant. */
    readonly statements = signal<AdminCreditStatement[]>([]);
    readonly transactions = signal<AdminCreditTransaction[]>([]);
    readonly loadingCreditHistory = signal(false);
    readonly generatingStatement = signal(false);
    /** Statement id whose PDF is currently downloading (for a per-row spinner). */
    readonly downloadingStatementId = signal<string | null>(null);

    /** Which row + API action is currently in flight. */
    readonly busyAction = signal<{
        userId: string;
        kind: RestaurantAction;
    } | null>(null);

    /** User targeted by credit limit / settle dialogs. */
    readonly actionUser = signal<AdminUserRow | null>(null);

    readonly selectedUser = computed(() => {
        const id = this.selectedId();
        return id ? this.users().find((u) => u.id === id) ?? null : null;
    });

    /** True when credit snapshot already has a limit value. */
    readonly hasCreditLimit = computed(() => {
        const limit = this.credit()?.creditLimit;
        return limit != null && !Number.isNaN(Number(limit));
    });

    /** Reveals the credit-limit input after "activate credit limit". */
    readonly editingCreditLimit = signal(false);

    /** Save is only for setting an initial credit limit from the detail panel. */
    needsCreditLimitSave(): boolean {
        return !this.hasCreditLimit() && this.editingCreditLimit();
    }

    startEditingCreditLimit(): void {
        this.editingCreditLimit.set(true);
        if (!this.creditLimitForm.controls.creditLimit.value) {
            this.creditLimitForm.patchValue({ creditLimit: 0 });
        }
    }

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

    readonly createForm = this._formBuilder.nonNullable.group({
        email: [
            '',
            [
                Validators.required,
                Validators.email,
                Validators.maxLength(EMAIL_MAX_LENGTH),
            ],
        ],
        password: ['', [Validators.required, passwordStrengthValidator]],
        restaurantName: [
            '',
            [
                Validators.required,
                Validators.maxLength(RESTAURANT_NAME_MAX_LENGTH),
            ],
        ],
        phone: [
            '',
            [phoneNumberValidator, Validators.maxLength(PHONE_MAX_LENGTH)],
        ],
    });

    readonly creditLimitForm = this._formBuilder.nonNullable.group({
        creditLimit: [0, [Validators.required, Validators.min(0)]],
        note: [''],
    });

    readonly settleForm = this._formBuilder.nonNullable.group({
        amount: [0, [Validators.required, Validators.min(0.01)]],
        paymentMethod: [''],
        reference: [''],
        note: [''],
    });

    /** Period picker for generating a monthly statement (defaults to now). */
    readonly statementForm = this._formBuilder.nonNullable.group({
        year: [
            new Date().getFullYear(),
            [Validators.required, Validators.min(2000), Validators.max(2100)],
        ],
        month: [
            new Date().getMonth() + 1,
            [Validators.required, Validators.min(1), Validators.max(12)],
        ],
    });

    /** 1–12, for the statement month picker. */
    readonly months = Array.from({ length: 12 }, (_, i) => i + 1);

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
                this.closeDetails();
                this._load();
            });
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
        this.closeDetails();
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

    toggleDetails(user: AdminUserRow): void {
        if (this.selectedId() === user.id) {
            this.closeDetails();
            return;
        }
        this.selectedId.set(user.id);
        this._loadCreditSnapshot(user.restaurantId ?? null);
    }

    closeDetails(): void {
        this.selectedId.set(null);
        this.credit.set(null);
        this.editingCreditLimit.set(false);
    }

    openCreatePanel(): void {
        if (!this._createPanel || this._dialogRef) {
            return;
        }
        this.closeDetails();
        this.createForm.reset({
            email: '',
            password: '',
            restaurantName: '',
            phone: '',
        });
        this._dialogRef = this._dialog.open(this._createPanel, {
            autoFocus: false,
            maxWidth: '100vw',
        });
        this._dialogRef.afterClosed().subscribe(() => {
            this._dialogRef = null;
            this.createForm.enable();
        });
    }

    closeCreatePanel(): void {
        this._dialogRef?.close();
    }

    createRestaurant(ngForm: FormGroupDirective): void {
        if (this.createForm.invalid) {
            this.createForm.markAllAsTouched();
            return;
        }
        const value = this.createForm.getRawValue();
        this.createForm.disable();
        this._admin
            .createUser({
                email: value.email.trim(),
                password: value.password,
                role: RESTAURANT_ROLE,
                marketId: null,
                restaurantName: value.restaurantName.trim() || null,
                phone: value.phone.trim() || null,
            })
            .then(() => {
                this._notify('admin.restaurants.create.success');
                this.closeCreatePanel();
                this.pageIndex.set(0);
                this._load();
            })
            .catch(async (err) => {
                this.createForm.enable();
                this._notifyText(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.restaurants.create.error'
                    )
                );
            })
            .finally(() => ngForm.form.markAsPristine());
    }

    approve(user: AdminUserRow): void {
        this._runRestaurantAction(
            user,
            'approve',
            (id) => this._admin.approveRestaurant(id),
            'admin.restaurants.approve.success'
        );
    }

    suspend(user: AdminUserRow): void {
        this._runRestaurantAction(
            user,
            'suspend',
            (id) => this._admin.suspendRestaurant(id),
            'admin.restaurants.suspend.success'
        );
    }

    reactivate(user: AdminUserRow): void {
        this._runRestaurantAction(
            user,
            'reactivate',
            (id) => this._admin.reactivateRestaurant(id),
            'admin.restaurants.reactivate.success'
        );
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

    saveCreditLimit(user: AdminUserRow): void {
        const restaurantId = user.restaurantId;
        if (!restaurantId || this.creditLimitForm.invalid) {
            this.creditLimitForm.markAllAsTouched();
            return;
        }
        if (this.hasCreditLimit()) {
            return;
        }
        const { creditLimit, note } = this.creditLimitForm.getRawValue();
        this.busyAction.set({ userId: user.id, kind: 'creditLimit' });
        this._admin
            .setCreditLimit(restaurantId, {
                creditLimit,
                note: note || null,
            })
            .then(() => {
                this._notify('admin.restaurants.creditLimit.success');
                this._loadCreditSnapshot(restaurantId);
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.busyAction.set(null));
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
                if (this.selectedId() === user.id) {
                    this._loadCreditSnapshot(restaurantId);
                }
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.busyAction.set(null));
    }

    passwordRuleFailing(rule: string): boolean {
        const control = this.createForm.controls.password;
        if (!control.value) {
            return true;
        }
        const strength = control.errors?.['passwordStrength'] as
            | Record<string, boolean>
            | undefined;
        return strength ? !!strength[rule] : false;
    }

    trackById(_: number, row: { id: string }): string {
        return row.id;
    }

    private _runRestaurantAction(
        user: AdminUserRow,
        kind: RestaurantAction,
        action: (restaurantId: string) => Promise<void>,
        successKey: string
    ): void {
        const restaurantId = user.restaurantId;
        if (!restaurantId) {
            this._notify('admin.restaurants.noRestaurantId');
            return;
        }
        this.busyAction.set({ userId: user.id, kind });
        action(restaurantId)
            .then(() => {
                this._notify(successKey);
                if (kind === 'suspend') {
                    this._patchUser(user.id, { isActive: false });
                } else if (kind === 'reactivate') {
                    this._patchUser(user.id, { isActive: true });
                }
                if (this.selectedId() === user.id) {
                    this._loadCreditSnapshot(restaurantId);
                }
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.busyAction.set(null));
    }

    private _patchUser(id: string, patch: Partial<AdminUserRow>): void {
        this.users.update((list) =>
            list.map((u) => (u.id === id ? { ...u, ...patch } : u))
        );
    }

    private _loadCreditSnapshot(restaurantId: string | null): void {
        this.credit.set(null);
        this.editingCreditLimit.set(false);
        this.creditLimitForm.reset({ creditLimit: 0, note: '' });
        this.statements.set([]);
        this.transactions.set([]);
        if (!restaurantId) {
            return;
        }
        this.loadingCredit.set(true);
        this._admin
            .getRestaurantCredit(restaurantId)
            .then((credit) => {
                this.credit.set(credit);
                this.creditLimitForm.reset({
                    creditLimit:
                        credit?.creditLimit != null
                            ? Number(credit.creditLimit) || 0
                            : 0,
                    note: '',
                });
            })
            .finally(() => this.loadingCredit.set(false));
        this._loadCreditHistory(restaurantId);
    }

    /** Loads the statements + transactions lists (best-effort; empty on failure). */
    private _loadCreditHistory(restaurantId: string): void {
        this.loadingCreditHistory.set(true);
        Promise.all([
            this._admin.getCreditStatements(restaurantId),
            this._admin.getCreditTransactions(restaurantId),
        ])
            .then(([statements, transactions]) => {
                this.statements.set(statements);
                this.transactions.set(transactions);
            })
            .finally(() => this.loadingCreditHistory.set(false));
    }

    /** Generates (or regenerates) the statement for the picked year/month. */
    generateStatement(user: AdminUserRow): void {
        const restaurantId = user.restaurantId;
        if (!restaurantId || this.statementForm.invalid) {
            this.statementForm.markAllAsTouched();
            return;
        }
        const { year, month } = this.statementForm.getRawValue();
        this.generatingStatement.set(true);
        this._admin
            .generateCreditStatement(restaurantId, { year, month })
            .then(() => {
                this._notify('admin.restaurants.statements.generateSuccess');
                this._loadCreditHistory(restaurantId);
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.generatingStatement.set(false));
    }

    /** Downloads a statement PDF via an object URL, then revokes it. */
    downloadStatementPdf(
        user: AdminUserRow,
        statement: AdminCreditStatement
    ): void {
        const restaurantId = user.restaurantId;
        if (!restaurantId || !statement.id) {
            return;
        }
        this.downloadingStatementId.set(statement.id);
        this._admin
            .getStatementPdf(restaurantId, statement.id)
            .then((blob) => {
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `statement-${statement.year ?? ''}-${
                    statement.month ?? ''
                }.pdf`;
                anchor.click();
                URL.revokeObjectURL(url);
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.downloadingStatementId.set(null));
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
            const id = this.selectedId();
            if (id && !result.users.some((u) => u.id === id)) {
                this.closeDetails();
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
