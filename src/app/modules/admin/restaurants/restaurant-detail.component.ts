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
import {
    nonBlankValidator,
    trimmedMaxLengthValidator,
} from 'app/core/api/validators';
import { DateTime } from 'luxon';
import { AdminService } from '../admin.service';
import {
    AdminCreditStatement,
    AdminCreditStatementDetail,
    AdminCreditTransaction,
    AdminRestaurantCredit,
    AdminRestaurantProfile,
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

/**
 * Billing periods are bounded in Vietnam local time server-side
 * (`CreditStatementPeriodCalculator.VietnamTimeZone`), so "has this month
 * closed?" must be asked in the same zone — not the browser's.
 */
const STATEMENT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

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
    /** Kept apart from `_dialogRef`, which the lifecycle actions own. */
    private _statementRef: MatDialogRef<unknown> | null = null;

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

    /**
     * The statement opened from the list, re-read by id. The list returns
     * headers only (`CreditStatementSummaryDto`), so the movements that add up
     * to a closing balance — and the due date — exist nowhere else in the UI.
     */
    readonly openStatement = signal<AdminCreditStatementDetail | null>(null);
    readonly openStatementId = signal<string | null>(null);
    readonly loadingStatement = signal(false);
    readonly statementError = signal<string | null>(null);
    readonly busyAction = signal<RestaurantAction | null>(null);
    readonly editingCreditLimit = signal(false);

    /**
     * The legal / e-invoice profile behind this account. Approving is a
     * judgement on these fields (business licence, tax code, invoice identity),
     * and `GET /admin/users` does not carry any of them — so the page fetches
     * the full profile rather than approving blind.
     */
    readonly profile = signal<AdminRestaurantProfile | null>(null);
    readonly loadingProfile = signal(false);
    readonly profileError = signal<string | null>(null);

    /**
     * The licence document, when one was uploaded. Rendered as a link, never as
     * text: a signed Cloudinary URL is unreadable and unusable inline.
     */
    readonly businessLicenseUrl = computed(() => {
        const url = this.profile()?.businessLicenseUrl;
        return typeof url === 'string' && url.trim() ? url.trim() : null;
    });

    /**
     * The e-invoice identity fields, in issuing order. Each renders even when
     * empty — a missing tax code is exactly what an approver needs to see, so a
     * blank row is information, not noise.
     */
    readonly legalFields = computed(() => {
        const p = this.profile();
        if (!p) {
            return [];
        }
        return [
            { label: 'admin.restaurants.legal.taxCode', value: p.taxCode },
            {
                label: 'admin.restaurants.legal.invoiceLegalName',
                value: p.invoiceLegalName,
            },
            {
                label: 'admin.restaurants.legal.invoiceAddress',
                value: p.invoiceAddress,
            },
            {
                label: 'admin.restaurants.legal.invoiceEmail',
                value: p.invoiceEmail,
            },
            {
                label: 'admin.restaurants.legal.contactPerson',
                value: p.contactPerson,
            },
            { label: 'admin.restaurants.legal.address', value: p.address },
            {
                label: 'admin.restaurants.legal.pickupWindow',
                value: this._pickupWindow(p),
            },
        ].map((row) => ({
            label: row.label,
            value: this._textOrDash(row.value),
            missing: !this._hasText(row.value),
        }));
    });

    /**
     * Whether anything an approver needs is still blank. Surfaced as a warning
     * above the approve action so an incomplete account is not waved through —
     * the backend does not block it, this is a judgement aid.
     */
    readonly hasIncompleteLegalProfile = computed(
        () =>
            !!this.profile() &&
            (this.legalFields().some((f) => f.missing) ||
                !this.businessLicenseUrl())
    );

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
        // `SettleCreditRequest.reference` is required, 1–200 chars: a payment
        // without one is rejected 400, so the form asks for it up front.
        reference: [
            '',
            [
                Validators.required,
                nonBlankValidator,
                trimmedMaxLengthValidator(REFERENCE_MAX_LENGTH),
            ],
        ],
        note: [''],
    });

    /**
     * The most recent billing period that has actually closed, in
     * `Asia/Ho_Chi_Minh` — the timezone the server computes period boundaries
     * in (`CreditStatementPeriodCalculator`). Always the previous calendar
     * month: a period ends at the first instant of the following month, so the
     * current month is never generatable.
     */
    private readonly _latestClosedPeriod = DateTime.now()
        .setZone(STATEMENT_TIME_ZONE)
        .minus({ months: 1 });

    /**
     * Defaults to the latest **closed** month, not today's.
     *
     * The form used to default to the current month, which meant the very
     * first click always failed — and failed badly: `STATEMENT_PERIOD_NOT_CLOSED`
     * is not registered in the backend's `ErrorExtensions`, so it comes back as
     * an HTTP **500**, not a readable 4xx. The picker below only offers closed
     * periods, so that response is unreachable from here.
     */
    readonly statementForm = this._formBuilder.nonNullable.group({
        year: [
            this._latestClosedPeriod.year,
            [
                Validators.required,
                Validators.min(2000),
                Validators.max(this._latestClosedPeriod.year),
            ],
        ],
        month: [
            this._latestClosedPeriod.month,
            [Validators.required, Validators.min(1), Validators.max(12)],
        ],
    });

    /** Years that contain at least one closed period. */
    readonly statementYears = Array.from(
        { length: 6 },
        (_, i) => this._latestClosedPeriod.year - i
    );

    /**
     * Months selectable for the chosen year — every month up to and including
     * the latest closed one. A month is a signal-free getter because it reads
     * the form control, which is not a signal.
     */
    availableMonths(): number[] {
        const year = Number(this.statementForm.controls.year.value);
        if (!Number.isFinite(year) || year > this._latestClosedPeriod.year) {
            return [];
        }
        const last =
            year === this._latestClosedPeriod.year
                ? this._latestClosedPeriod.month
                : 12;
        return Array.from({ length: last }, (_, i) => i + 1);
    }

    /** Human-readable label of the newest period that can still be generated. */
    latestClosedPeriodLabel(): string {
        return this._latestClosedPeriod.toFormat('MM/yyyy');
    }

    /**
     * True when the chosen year+month is a period that has fully elapsed. The
     * generate button is disabled otherwise.
     */
    isStatementPeriodClosed(): boolean {
        const { year, month } = this.statementForm.getRawValue();
        if (!Number.isFinite(year) || !Number.isFinite(month)) {
            return false;
        }
        return (
            year < this._latestClosedPeriod.year ||
            (year === this._latestClosedPeriod.year &&
                month <= this._latestClosedPeriod.month)
        );
    }

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
                this._loadProfile(passed.restaurantId);
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
                reference: reference.trim(),
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
        if (
            !restaurantId ||
            this.statementForm.invalid ||
            !this.isStatementPeriodClosed()
        ) {
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

    /**
     * Opens a statement's line items (`GET .../statements/{statementId}`).
     *
     * The header from the list row is shown straight away so the panel is never
     * blank, and is replaced by the by-id read once the lines arrive.
     */
    openStatementDetail(
        statement: AdminCreditStatement,
        template: TemplateRef<unknown>
    ): void {
        const restaurantId = this.user()?.restaurantId;
        if (!restaurantId || !statement.id || this._statementRef) {
            return;
        }
        this.openStatement.set({ ...statement, lines: [] });
        this.openStatementId.set(statement.id);
        this.statementError.set(null);
        this._statementRef = this._dialog.open(template, {
            autoFocus: 'first-tabbable',
            maxWidth: '95vw',
        });
        this._statementRef.afterClosed().subscribe(() => {
            this._statementRef = null;
            this.openStatement.set(null);
            this.openStatementId.set(null);
        });

        this.loadingStatement.set(true);
        this._admin
            .getCreditStatement(String(restaurantId), statement.id)
            .then((detail) => {
                if (this.openStatementId() !== statement.id) {
                    return; // Dialog closed (or moved on) while in flight.
                }
                if (detail) {
                    this.openStatement.set(detail);
                }
            })
            .catch(async (err) => {
                if (this.openStatementId() !== statement.id) {
                    return;
                }
                // The header stays on screen — only the lines are missing, and
                // saying so beats an empty table that reads as "no movements".
                this.statementError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.restaurants.statements.detailError'
                    )
                );
            })
            .finally(() => this.loadingStatement.set(false));
    }

    closeStatementDetail(): void {
        this._statementRef?.close();
    }

    /** `MM/yyyy` for a statement, or `—` when the period could not be read. */
    statementPeriodLabel(statement: AdminCreditStatement): string {
        const { year, month } = statement;
        return year && month
            ? `${String(month).padStart(2, '0')}/${year}`
            : '—';
    }

    /** Absolute timestamps, rendered in the reader's locale. */
    formatDateTime(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        const parsed = DateTime.fromISO(String(value));
        return parsed.isValid
            ? parsed.toLocaleString(DateTime.DATETIME_SHORT)
            : '—';
    }

    /** Sum of the line amounts, as a cross-check against the closing balance. */
    statementLineTotal(): number {
        return (this.openStatement()?.lines ?? []).reduce(
            (sum, line) => sum + (Number(line.amount) || 0),
            0
        );
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
                this._loadProfile(matched.restaurantId);
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
                // approve/suspend/reactivate move `status` on the profile too.
                this._loadProfile(restaurantId);
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.busyAction.set(null));
    }

    /** Re-reads the legal profile; also the retry action when it failed. */
    reloadProfile(): void {
        const restaurantId = this.user()?.restaurantId;
        if (restaurantId) {
            this._loadProfile(restaurantId);
        }
    }

    private _hasText(value: unknown): boolean {
        return typeof value === 'string' && value.trim().length > 0;
    }

    private _textOrDash(value: unknown): string {
        return this._hasText(value) ? (value as string).trim() : '—';
    }

    /** `HH:mm–HH:mm`, or `undefined` when either end is unset. */
    private _pickupWindow(profile: AdminRestaurantProfile): string | undefined {
        const start = this._trimSeconds(profile.pickupStart);
        const end = this._trimSeconds(profile.pickupEnd);
        return start && end ? `${start} – ${end}` : undefined;
    }

    /** `HH:mm:ss` → `HH:mm`; the seconds are always `00` and only add noise. */
    private _trimSeconds(value: unknown): string | undefined {
        if (!this._hasText(value)) {
            return undefined;
        }
        const text = (value as string).trim();
        const match = /^(\d{2}:\d{2})(:\d{2})?$/.exec(text);
        return match ? match[1] : text;
    }

    private _loadProfile(restaurantId: string): void {
        this.profile.set(null);
        this.profileError.set(null);
        this.loadingProfile.set(true);
        this._admin
            .getRestaurantProfile(restaurantId)
            .then((profile) => this.profile.set(profile))
            .catch(async (err) => {
                this.profile.set(null);
                // An empty legal panel would read as "this restaurant filed
                // nothing", which is the opposite of "we could not load it".
                this.profileError.set(
                    await describeApiError(
                        err,
                        (key) => this._transloco.translate(key),
                        'admin.restaurants.legal.loadError'
                    )
                );
            })
            .finally(() => this.loadingProfile.set(false));
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
