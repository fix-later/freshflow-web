import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnInit,
    TemplateRef,
    ViewChild,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';

const DEFAULT_PAGE_SIZE = 20;

/** Admin ▸ Users — list, filter, create and act on user accounts. */
@Component({
    selector: 'admin-users-list',
    templateUrl: './users-list.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
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
})
export class UsersListComponent implements OnInit {
    @ViewChild('createUserPanel') private _createPanel: TemplateRef<unknown>;

    private readonly _admin = inject(AdminService);
    private readonly _router = inject(Router);
    private readonly _dialog = inject(MatDialog);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _destroyRef = inject(DestroyRef);

    private _dialogRef: MatDialogRef<unknown> | null = null;

    readonly users = signal<AdminUserRow[]>([]);
    readonly totalCount = signal(0);
    readonly loading = signal(false);
    readonly roles = signal<string[]>([]);
    readonly markets = signal<{ id: string; name: string }[]>([]);
    readonly pageIndex = signal(0);
    readonly pageSize = signal(DEFAULT_PAGE_SIZE);

    readonly filterForm = this._formBuilder.nonNullable.group({
        search: [''],
        role: [''],
        isActive: [''],
    });

    readonly createForm = this._formBuilder.nonNullable.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        role: ['', Validators.required],
        marketId: [''],
        restaurantName: [''],
        phone: [''],
    });

    ngOnInit(): void {
        this._loadRoles();
        this._loadMarkets();
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
        this.filterForm.reset({ search: '', role: '', isActive: '' });
    }

    openDetail(user: AdminUserRow): void {
        this._router.navigate(['/admin/users', user.id], { state: { user } });
    }

    openCreatePanel(): void {
        if (!this._createPanel || this._dialogRef) {
            return;
        }
        this.createForm.reset({
            email: '',
            password: '',
            role: '',
            marketId: '',
            restaurantName: '',
            phone: '',
        });
        this._dialogRef = this._dialog.open(this._createPanel, {
            width: '28rem',
            maxWidth: 'calc(100vw - 2rem)',
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
            return;
        }
        const value = this.createForm.getRawValue();
        this.createForm.disable();
        this._admin
            .createUser({
                email: value.email,
                password: value.password,
                role: value.role,
                marketId: value.marketId || null,
                restaurantName: value.restaurantName || null,
                phone: value.phone || null,
            })
            .then(() => {
                this._notify('admin.users.create.success');
                this.closeCreatePanel();
                this.pageIndex.set(0);
                this._load();
            })
            .catch(() => {
                this.createForm.enable();
                this._notify('admin.users.create.error');
            })
            .finally(() => ngForm.form.markAsPristine());
    }

    toggleActive(user: AdminUserRow): void {
        const nextActive = !user.isActive;
        this._admin
            .setUserActive(user.id, nextActive)
            .then(() => {
                this._notify(
                    nextActive
                        ? 'admin.users.activate.success'
                        : 'admin.users.deactivate.success'
                );
                this._load();
            })
            .catch(() => this._notify('admin.users.actionError'));
    }

    unlock(user: AdminUserRow): void {
        this._admin
            .unlockUser(user.id)
            .then(() => {
                this._notify('admin.users.unlock.success');
                this._load();
            })
            .catch(() => this._notify('admin.users.actionError'));
    }

    trackById(_: number, user: AdminUserRow): string {
        return user.id;
    }

    private _load(): void {
        this.loading.set(true);
        const raw = this.filterForm.getRawValue();
        this._admin
            .getUsers({
                search: raw.search || undefined,
                role: raw.role || undefined,
                isActive:
                    raw.isActive === '' ? undefined : raw.isActive === 'true',
                page: this.pageIndex() + 1,
                pageSize: this.pageSize(),
            })
            .then((result) => {
                this.users.set(result.users);
                this.totalCount.set(result.totalCount);
            })
            .catch(() => {
                this.users.set([]);
                this.totalCount.set(0);
                this._notify('admin.users.loadError');
            })
            .finally(() => this.loading.set(false));
    }

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
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }
}
