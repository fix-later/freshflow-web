import { DecimalPipe } from '@angular/common';
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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { AdminService } from '../admin.service';
import {
    AdminCreditStatement,
    AdminCreditTransaction,
    AdminRestaurantCredit,
    AdminUserRow,
} from '../admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';

type RestaurantAction =
    | 'approve'
    | 'suspend'
    | 'reactivate'
    | 'creditLimit'
    | 'settle';

@Component({
    selector: 'admin-restaurant-detail',
    templateUrl: './restaurant-detail.component.html',
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
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class RestaurantDetailComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _dialog = inject(MatDialog);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);

    private _dialogRef: MatDialogRef<unknown> | null = null;

    readonly loading = signal(false);
    readonly notFound = signal(false);
    readonly user = signal<AdminUserRow | null>(null);
    readonly credit = signal<AdminRestaurantCredit | null>(null);
    readonly loadingCredit = signal(false);
    readonly statements = signal<AdminCreditStatement[]>([]);
    readonly transactions = signal<AdminCreditTransaction[]>([]);
    readonly loadingCreditHistory = signal(false);
    readonly generatingStatement = signal(false);
    readonly downloadingStatementId = signal<string | null>(null);
    readonly busyAction = signal<RestaurantAction | null>(null);
    readonly editingCreditLimit = signal(false);

    readonly hasCreditLimit = computed(() => {
        const limit = this.credit()?.creditLimit;
        return limit != null && !Number.isNaN(Number(limit));
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

    readonly months = Array.from({ length: 12 }, (_, i) => i + 1);

    ngOnInit(): void {
        const userId = this._route.snapshot.paramMap.get('userId') ?? '';
        if (!userId) {
            this.notFound.set(true);
            return;
        }
        void this._loadUser(userId);
    }

    goBack(): void {
        void this._router.navigate(['/admin/restaurants']);
    }

    statusLabel(): string {
        return this.user()?.isActive
            ? this._transloco.translate('admin.users.filters.active')
            : this._transloco.translate('admin.users.filters.inactive');
    }

    startEditingCreditLimit(): void {
        this.editingCreditLimit.set(true);
        if (!this.creditLimitForm.controls.creditLimit.value) {
            this.creditLimitForm.patchValue({ creditLimit: 0 });
        }
    }

    saveCreditLimit(): void {
        const current = this.user();
        const restaurantId = current?.restaurantId;
        if (!current || !restaurantId || this.creditLimitForm.invalid) {
            this.creditLimitForm.markAllAsTouched();
            return;
        }
        if (this.hasCreditLimit()) {
            return;
        }
        const { creditLimit, note } = this.creditLimitForm.getRawValue();
        this.busyAction.set('creditLimit');
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

    approve(): void {
        this._runLifecycleAction(
            'approve',
            (id) => this._admin.approveRestaurant(id),
            'admin.restaurants.approve.success'
        );
    }

    suspend(): void {
        this._runLifecycleAction(
            'suspend',
            (id) => this._admin.suspendRestaurant(id),
            'admin.restaurants.suspend.success'
        );
    }

    reactivate(): void {
        this._runLifecycleAction(
            'reactivate',
            (id) => this._admin.reactivateRestaurant(id),
            'admin.restaurants.reactivate.success'
        );
    }

    openSettleDialog(template: TemplateRef<unknown>): void {
        const current = this.user();
        if (!current?.restaurantId || this._dialogRef) {
            return;
        }
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
        });
    }

    closeActionDialog(): void {
        this._dialogRef?.close();
    }

    settleCredit(): void {
        const current = this.user();
        const restaurantId = current?.restaurantId;
        if (!current || !restaurantId || this.settleForm.invalid) {
            this.settleForm.markAllAsTouched();
            return;
        }
        const { amount, paymentMethod, reference, note } =
            this.settleForm.getRawValue();
        this.busyAction.set('settle');
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
                this._loadCreditSnapshot(restaurantId);
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.busyAction.set(null));
    }

    generateStatement(): void {
        const current = this.user();
        const restaurantId = current?.restaurantId;
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

    downloadStatementPdf(statement: AdminCreditStatement): void {
        const current = this.user();
        const restaurantId = current?.restaurantId;
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

    private async _loadUser(userId: string): Promise<void> {
        this.loading.set(true);
        this.notFound.set(false);
        try {
            const result = await this._admin.getUsers({
                search: userId,
                role: 'restaurant',
                page: 1,
                pageSize: 100,
            });
            const matched =
                result.users.find((u) => u.id === userId) ??
                result.users.find((u) => u.restaurantId === userId) ??
                null;
            this.user.set(matched);
            this.notFound.set(!matched);
            if (matched?.restaurantId) {
                this._loadCreditSnapshot(matched.restaurantId);
            }
        } catch {
            this.user.set(null);
            this.notFound.set(true);
        } finally {
            this.loading.set(false);
        }
    }

    private _runLifecycleAction(
        kind: RestaurantAction,
        action: (restaurantId: string) => Promise<void>,
        successKey: string
    ): void {
        const current = this.user();
        const restaurantId = current?.restaurantId;
        if (!current || !restaurantId) {
            return;
        }
        this.busyAction.set(kind);
        action(restaurantId)
            .then(() => {
                this._notify(successKey);
                if (kind === 'suspend') {
                    this.user.update((u) =>
                        u ? { ...u, isActive: false } : u
                    );
                } else if (kind === 'reactivate') {
                    this.user.update((u) => (u ? { ...u, isActive: true } : u));
                }
                this._loadCreditSnapshot(restaurantId);
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.busyAction.set(null));
    }

    private _loadCreditSnapshot(restaurantId: string): void {
        this.credit.set(null);
        this.editingCreditLimit.set(false);
        this.creditLimitForm.reset({ creditLimit: 0, note: '' });
        this.statements.set([]);
        this.transactions.set([]);
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

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    private async _notifyError(err: unknown): Promise<void> {
        const message = await describeApiError(
            err,
            (key) => this._transloco.translate(key),
            'admin.restaurants.actionError'
        );
        this._snackBar.open(message, undefined, { duration: 5000 });
    }
}
