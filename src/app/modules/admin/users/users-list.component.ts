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
import { AdminUserRow } from '../admin.types';
import { CoalescedTask } from '../shared/coalesced-task';
import { TableSort } from '../shared/table-sort';

const DEFAULT_PAGE_SIZE = 20;
const AGENT_ROLES = ['market_agent', 'kiosk_staff'];
const RESTAURANT_ROLE = 'restaurant';
const RESTAURANT_NAME_MAX_LENGTH = 200;
const PHONE_MAX_LENGTH = 20;

/**
 * Admin ▸ Users — Fuse ecommerce inventory pattern: searchable list with an
 * expandable detail panel (profile, role, activate). Unlock lives on the row;
 * market-agent assignment is managed from the Markets screen.
 */
@Component({
    selector: 'admin-users-list',
    templateUrl: './users-list.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
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
    ],
    styles: [
        `
            .users-grid {
                grid-template-columns:
                    minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr)
                    minmax(0, 1fr) auto auto;
            }
        `,
    ],
})
export class UsersListComponent implements OnInit {
    protected readonly expandOnEnter = expandOnEnter;
    protected readonly collapseOnLeave = collapseOnLeave;

    @ViewChild('createUserPanel') private _createPanel!: TemplateRef<unknown>;

    private readonly _admin = inject(AdminService);
    private readonly _dialog = inject(MatDialog);
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
    readonly roles = signal<string[]>([]);
    readonly markets = signal<{ id: string; name: string }[]>([]);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(DEFAULT_PAGE_SIZE);

    readonly selectedId = signal<string | null>(null);
    readonly savingRole = signal(false);
    readonly savingActive = signal(false);
    readonly unlocking = signal(false);

    readonly selectedUser = computed(() => {
        const id = this.selectedId();
        return id ? this.users().find((u) => u.id === id) ?? null : null;
    });

    readonly filterForm = this._formBuilder.nonNullable.group({
        search: [''],
        role: [''],
        isActive: [''],
    });

    /** Latest filter form values (for template reactivity). */
    private readonly _filterValues = toSignal(this.filterForm.valueChanges, {
        initialValue: this.filterForm.getRawValue(),
    });

    /** True when search / role / status filter is non-empty. */
    readonly hasActiveFilters = computed(() => {
        const v = this._filterValues();
        return (
            (v.search ?? '').trim() !== '' ||
            !!(v.role ?? '') ||
            !!(v.isActive ?? '')
        );
    });

    readonly roleForm = this._formBuilder.nonNullable.group({
        role: ['', Validators.required],
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
        role: ['', Validators.required],
        marketId: [''],
        restaurantName: ['', Validators.maxLength(RESTAURANT_NAME_MAX_LENGTH)],
        phone: [
            '',
            [phoneNumberValidator, Validators.maxLength(PHONE_MAX_LENGTH)],
        ],
    });

    readonly selectedRole = signal('');
    readonly needsMarket = computed(() =>
        AGENT_ROLES.includes(this.selectedRole())
    );
    readonly needsRestaurantName = computed(
        () => this.selectedRole() === RESTAURANT_ROLE
    );

    ngOnInit(): void {
        this._loadRoles();
        this._loadMarkets();
        this._load();

        this.createForm.controls.role.valueChanges
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe((role) => this._applyRoleValidators(role));

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
        this.filterForm.reset({ search: '', role: '', isActive: '' });
    }

    toggleDetails(user: AdminUserRow): void {
        if (this.selectedId() === user.id) {
            this.closeDetails();
            return;
        }
        this.selectedId.set(user.id);
        this.roleForm.reset({ role: user.role ?? '' });
    }

    closeDetails(): void {
        this.selectedId.set(null);
    }

    openCreatePanel(): void {
        if (!this._createPanel || this._dialogRef) {
            return;
        }
        this.closeDetails();
        this.createForm.reset({
            email: '',
            password: '',
            role: '',
            marketId: '',
            restaurantName: '',
            phone: '',
        });
        this.selectedRole.set('');
        this._applyRoleValidators('');
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

    createUser(ngForm: FormGroupDirective): void {
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
                role: value.role,
                marketId: this.needsMarket() ? value.marketId || null : null,
                restaurantName: this.needsRestaurantName()
                    ? value.restaurantName.trim() || null
                    : null,
                phone: value.phone.trim() || null,
            })
            .then(() => {
                this._notify('admin.users.create.success');
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
                        'admin.users.create.error'
                    )
                );
            })
            .finally(() => ngForm.form.markAsPristine());
    }

    saveRole(): void {
        const user = this.selectedUser();
        if (!user || this.roleForm.invalid) {
            return;
        }
        const roleName = this.roleForm.getRawValue().role;
        this.savingRole.set(true);
        this._admin
            .assignRole(user.id, roleName)
            .then(() => {
                this._patchUser(user.id, { role: roleName });
                this._notify('admin.userDetail.role.success');
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.savingRole.set(false));
    }

    toggleActive(user: AdminUserRow = this.selectedUser()!): void {
        if (!user) {
            return;
        }
        const nextActive = !user.isActive;
        this.savingActive.set(true);
        this._admin
            .setUserActive(user.id, nextActive)
            .then(() => {
                this._patchUser(user.id, { isActive: nextActive });
                this._notify(
                    nextActive
                        ? 'admin.users.activate.success'
                        : 'admin.users.deactivate.success'
                );
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.savingActive.set(false));
    }

    unlock(user: AdminUserRow): void {
        this.unlocking.set(true);
        this._admin
            .unlockUser(user.id)
            .then(() => {
                this._patchUser(user.id, { lockedUntil: null });
                this._notify('admin.users.unlock.success');
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.unlocking.set(false));
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

    trackById(_: number, user: AdminUserRow): string {
        return user.id;
    }

    private _patchUser(id: string, patch: Partial<AdminUserRow>): void {
        this.users.update((list) =>
            list.map((u) => (u.id === id ? { ...u, ...patch } : u))
        );
    }

    private _applyRoleValidators(role: string): void {
        this.selectedRole.set(role);
        const market = this.createForm.controls.marketId;
        const restaurantName = this.createForm.controls.restaurantName;

        market.setValidators(
            AGENT_ROLES.includes(role) ? [Validators.required] : []
        );
        restaurantName.setValidators(
            role === RESTAURANT_ROLE
                ? [
                      Validators.required,
                      Validators.maxLength(RESTAURANT_NAME_MAX_LENGTH),
                  ]
                : [Validators.maxLength(RESTAURANT_NAME_MAX_LENGTH)]
        );
        market.updateValueAndValidity();
        restaurantName.updateValueAndValidity();
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
                role: raw.role || undefined,
                isActive:
                    raw.isActive === '' ? undefined : raw.isActive === 'true',
                page: this.pageIndex() + 1,
                pageSize: this.pageSize(),
            });
            this.users.set(result.users);
            this.totalCount.set(result.totalCount);
            const id = this.selectedId();
            if (id && !result.users.some((u) => u.id === id)) {
                this.closeDetails();
            }
        } catch {
            this.users.set([]);
            this.totalCount.set(0);
            this._notify('admin.users.loadError');
        } finally {
            this.loading.set(false);
        }
    });

    private _loadRoles(): void {
        this._admin
            .getRoles()
            .then((roles) => this.roles.set(roles))
            .catch(() => this.roles.set([]));
    }

    private _loadMarkets(): void {
        this._admin
            .getMarkets()
            .then((markets) => this.markets.set(markets))
            .catch(() => this.markets.set([]));
    }

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
                'admin.userDetail.actionError'
            )
        );
    }
}
