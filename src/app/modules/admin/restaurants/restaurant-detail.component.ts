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
import {
    FormBuilder,
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
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    applyApiErrorToForm,
    clearServerErrors,
    fieldErrorKey,
    fieldMaxLength,
    serverError,
} from 'app/core/api/form-errors';
import { trimmedMaxLengthValidator } from 'app/core/api/validators';
import { AdminService } from '../admin.service';
import {
    AdminCreditStatement,
    AdminCreditTransaction,
    AdminRestaurantCredit,
    AdminUserRow,
} from '../admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';

/** Actions this page can start against a restaurant. */
type RestaurantAction =
    | 'approve'
    | 'suspend'
    | 'reactivate'
    | 'creditLimit'
    | 'settle';

interface ProfileField {
    label: string;
    value: string;
}

/**
 * What each lifecycle action leaves the row in, so the pills update the moment
 * the call succeeds instead of waiting for a reload. Confirmed against the live
 * API — none of these endpoints touch `isActive`.
 */
const LIFECYCLE_PATCH: Partial<
    Record<RestaurantAction, Partial<AdminUserRow>>
> = {
    approve: { isApproved: true, restaurantStatus: 'active' },
    suspend: { isApproved: false, restaurantStatus: 'suspended' },
    reactivate: { isApproved: true, restaurantStatus: 'active' },
};

const RESTAURANT_ROLE = 'restaurant';
const USER_LOOKUP_PAGE_SIZE = 100;
const USER_LOOKUP_MAX_PAGES = 20;

@Component({
    selector: 'admin-restaurant-detail',
    templateUrl: './restaurant-detail.component.html',
    styleUrl: './restaurant-detail.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'relative flex min-h-0 flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        DecimalPipe,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
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

    /**
     * The limit currently in force. `GET /restaurants/{id}/credit` always
     * answers with a record — a restaurant that has never been given a limit
     * reads back `creditLimit: 0`, never `null` — so this is never blank.
     */
    readonly creditLimit = computed(() => {
        const limit = Number(this.credit()?.creditLimit);
        return Number.isFinite(limit) ? limit : 0;
    });

    /**
     * What the restaurant owes. The live field is `outstandingBalance`;
     * `currentBalance` is only a tolerated alias, so reading the alias alone
     * left the tile showing "—" for every restaurant.
     */
    readonly outstandingBalance = computed(() => {
        const snapshot = this.credit();
        const raw = snapshot?.outstandingBalance ?? snapshot?.currentBalance;
        return raw == null ? null : Number(raw);
    });

    readonly availableCredit = computed(() => {
        const raw = this.credit()?.availableCredit;
        return raw == null ? null : Number(raw);
    });

    /**
     * `SetCreditLimitRequest`: `creditLimit` `minimum: 0` (inclusive — a limit
     * of 0 freezes ordering rather than being invalid), `note` `maxLength: 500`.
     */
    readonly creditLimitForm = this._formBuilder.nonNullable.group({
        creditLimit: [0, [Validators.required, Validators.min(0)]],
        note: ['', [trimmedMaxLengthValidator(NOTE_MAX_LENGTH)]],
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

    /** Template helpers for per-field messages. */
    readonly errorKey = fieldErrorKey;
    readonly maxLength = fieldMaxLength;
    readonly serverMessage = serverError;

    /**
     * Localized reason the last credit action failed, when the rejection was
     * not per-field. A snackbar alone disappears before an operator recording
     * a payment has finished reading it.
     */
    readonly actionError = signal<string | null>(null);

    ngOnInit(): void {
        const userId = this._route.snapshot.paramMap.get('userId') ?? '';
        if (!userId) {
            this.notFound.set(true);
            return;
        }

        const passed = (history.state?.user ?? null) as AdminUserRow | null;
        if (passed?.id === userId) {
            this.user.set(passed);
            if (passed.restaurantId) {
                this._loadCreditSnapshot(passed.restaurantId);
            }
            void this._refreshUser(userId);
            return;
        }

        void this._loadUser(userId);
    }

    goBack(): void {
        void this._router.navigate(['/admin/restaurants']);
    }

    detailTitle(): string {
        const current = this.user();
        return (
            current?.restaurantName?.trim() ||
            current?.email?.trim() ||
            this._transloco.translate('admin.restaurants.unnamed')
        );
    }

    /**
     * The approval lifecycle is the only status worth showing here: the live
     * API reports `isActive: true` for every restaurant, so an account-active
     * label would read "Đang hoạt động" next to "Chờ duyệt".
     */
    statusLabel(): string {
        const u = this.user();
        return u ? this._transloco.translate(this.approvalKey(u)) : '—';
    }

    /** i18n key for the restaurant approval lifecycle pill (BR-AUTH-1). */
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
     * Which lifecycle action this restaurant can take next.
     *
     * Driven by `restaurantStatus` — the field the approve/suspend/reactivate
     * endpoints actually move. The menu used to key off `isActive`, which the
     * live API reports as `true` for every restaurant including the ones still
     * waiting for review: Duyệt and Kích hoạt lại could never appear, and Tạm
     * ngưng always did.
     */
    private _status(): string {
        const u = this.user();
        const status = String(u?.restaurantStatus ?? '')
            .trim()
            .toLowerCase();
        if (status) {
            return status;
        }
        return u?.isApproved ? 'active' : 'pending';
    }

    /** A restaurant awaiting review can be approved (BR-AUTH-1). */
    canApprove(): boolean {
        return this._status() === 'pending';
    }

    /** An approved, running restaurant can be suspended. */
    canSuspend(): boolean {
        return this._status() === 'active';
    }

    /** Only a suspended restaurant can be put back into service. */
    canReactivate(): boolean {
        return this._status() === 'suspended';
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

    profileFields(u: AdminUserRow): ProfileField[] {
        return [
            {
                label: this._transloco.translate(
                    'admin.restaurants.table.restaurant'
                ),
                value:
                    u.restaurantName?.trim() ||
                    this._transloco.translate('admin.restaurants.unnamed'),
            },
            {
                label: this._transloco.translate(
                    'admin.restaurants.table.email'
                ),
                value: u.email?.trim() || '—',
            },
            {
                label: this._transloco.translate(
                    'admin.restaurants.table.phone'
                ),
                value: u.phone?.trim() || '—',
            },
            {
                label: this._transloco.translate(
                    'admin.restaurants.table.status'
                ),
                value: this.statusLabel(),
            },
            {
                label: this._transloco.translate(
                    'admin.restaurants.lookup.label'
                ),
                value:
                    u.restaurantId?.trim() ||
                    this._transloco.translate(
                        'admin.restaurants.noRestaurantId'
                    ),
            },
        ];
    }

    /**
     * `PUT /admin/restaurants/{id}/credit/limit` is idempotent and repeatable,
     * so the limit stays editable for the life of the account — this is not a
     * one-shot activation.
     */
    startEditingCreditLimit(): void {
        clearServerErrors(this.creditLimitForm);
        this.actionError.set(null);
        this.creditLimitForm.reset({
            creditLimit: this.creditLimit(),
            note: '',
        });
        this.editingCreditLimit.set(true);
    }

    cancelEditingCreditLimit(): void {
        this.editingCreditLimit.set(false);
        clearServerErrors(this.creditLimitForm);
        this.actionError.set(null);
        this.creditLimitForm.reset({
            creditLimit: this.creditLimit(),
            note: '',
        });
    }

    saveCreditLimit(): void {
        const current = this.user();
        const restaurantId = current?.restaurantId;
        if (!current || !restaurantId || this.creditLimitForm.invalid) {
            this.creditLimitForm.markAllAsTouched();
            return;
        }
        const { creditLimit, note } = this.creditLimitForm.getRawValue();
        clearServerErrors(this.creditLimitForm);
        this.actionError.set(null);
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
            .catch(
                (err) =>
                    void this._reportFormError(
                        err,
                        this.creditLimitForm,
                        'admin.restaurants.creditLimit.error'
                    )
            )
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

    closeActionDialog(): void {
        this._dialogRef?.close();
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

    private async _refreshUser(userId: string): Promise<void> {
        try {
            const matched = await this._findRestaurantUser(userId);
            if (matched) {
                this.user.set(matched);
            }
        } catch {
            // Keep router state data when background refresh fails.
        }
    }

    private async _loadUser(userId: string): Promise<void> {
        this.loading.set(true);
        this.notFound.set(false);
        try {
            const matched = await this._findRestaurantUser(userId);
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

    private async _findRestaurantUser(
        userId: string
    ): Promise<AdminUserRow | null> {
        const bySearch = await this._admin.getUsers({
            role: RESTAURANT_ROLE,
            search: userId,
            pageSize: USER_LOOKUP_PAGE_SIZE,
        });
        const fromSearch = this._matchUser(bySearch.users, userId);
        if (fromSearch) {
            return fromSearch;
        }

        for (let page = 1; page <= USER_LOOKUP_MAX_PAGES; page++) {
            const result = await this._admin.getUsers({
                role: RESTAURANT_ROLE,
                page,
                pageSize: USER_LOOKUP_PAGE_SIZE,
            });
            const matched = this._matchUser(result.users, userId);
            if (matched) {
                return matched;
            }
            if (result.users.length < USER_LOOKUP_PAGE_SIZE) {
                break;
            }
        }

        return null;
    }

    private _matchUser(
        users: AdminUserRow[],
        userId: string
    ): AdminUserRow | null {
        return (
            users.find((u) => u.id === userId) ??
            users.find((u) => u.restaurantId === userId) ??
            null
        );
    }

    private _runLifecycleAction(
        kind: RestaurantAction,
        action: (restaurantId: string) => Promise<void>,
        successKey: string
    ): void {
        const current = this.user();
        const restaurantId = current?.restaurantId;
        if (!current || !restaurantId) {
            this._notify('admin.restaurants.noRestaurantId');
            return;
        }
        this.busyAction.set(kind);
        action(restaurantId)
            .then(() => {
                this._notify(successKey);
                // These endpoints move the *approval* lifecycle, not `isActive`
                // — verified against the live API: approve → isApproved true /
                // status active, suspend → status suspended + isApproved false,
                // reactivate → back to active, and `isActive` never changes.
                // Patching `isActive` flipped the wrong pill while the approval
                // one stayed stale, which is why an approved restaurant kept
                // reading "chờ duyệt" until a full reload.
                const patch = LIFECYCLE_PATCH[kind];
                if (patch) {
                    this.user.update((u) => (u ? { ...u, ...patch } : u));
                }
                // The optimistic patch is for the eye; the re-read is the
                // authority, in case the backend decided something else.
                void this._refreshUser(current.id);
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

    /**
     * Pins a rejection's field detail onto `form` and shows the rest inline
     * plus as a toast — the banner stays put while the operator fixes it.
     */
    private async _reportFormError(
        err: unknown,
        form: FormGroup,
        fallbackKey: string
    ): Promise<void> {
        const translate = (key: string): string =>
            this._transloco.translate(key);
        const { handled } = await applyApiErrorToForm(form, err, translate);
        if (handled) {
            this.actionError.set(translate('errors.api.validation'));
            return;
        }
        const message = await describeApiError(err, translate, fallbackKey);
        this.actionError.set(message);
        this._snackBar.open(message, undefined, { duration: 6000 });
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

/** `note` is `maxLength: 500` on both SetCreditLimitRequest and SettleCreditRequest. */
const NOTE_MAX_LENGTH = 500;

/** `SettleCreditRequest.reference` — `maxLength: 200`. */
const REFERENCE_MAX_LENGTH = 200;
