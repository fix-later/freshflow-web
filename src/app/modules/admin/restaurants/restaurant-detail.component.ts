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
import { toSignal } from '@angular/core/rxjs-interop';
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
import { MatTabsModule } from '@angular/material/tabs';
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
import { ApiLabelPipe } from 'app/core/i18n/api-label.pipe';
import { DateTime } from 'luxon';
import { AdminService } from '../admin.service';
import {
    AdminCreditStatement,
    AdminCreditStatementDetail,
    AdminCreditTransaction,
    AdminInvoiceRow,
    AdminOrderDetail,
    AdminOrderItem,
    AdminRestaurantCredit,
    AdminRestaurantProfile,
    AdminUserRow,
} from '../admin.types';
import { orderStatusPillClass } from '../orders/orders-list.component';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { newestActiveFirst } from '../shared/row-order';
import {
    creditTypePillClass,
    invoiceStatusPillClass,
    paymentStatusPillClass,
} from '../shared/status-pills';

/** Actions this page can start against a restaurant. */
type RestaurantAction =
    | 'approve'
    | 'reactivate'
    | 'creditLimit'
    | 'settle'
    | 'unlock'
    | 'account';

/**
 * The page's four jobs. What the restaurant owes is settled on the first tab,
 * beside the licence it was approved on; the other three are each a ledger of
 * their own, and their fetches are wasted work while an approver is only
 * reading the profile.
 */
export const RESTAURANT_DETAIL_TABS = [
    { index: 0, label: 'admin.restaurants.detailPage.tabs.info' },
    { index: 1, label: 'admin.restaurants.detailPage.tabs.history' },
    { index: 2, label: 'admin.restaurants.detailPage.tabs.invoices' },
] as const;

const HISTORY_TAB = 1;
const INVOICES_TAB = 2;

/** Both ledgers are served by the one credit-history read. */
const LEDGER_TABS: readonly number[] = [HISTORY_TAB, INVOICES_TAB];

interface ProfileField {
    /** Heroicons id, rendered with the `heroicons_outline:` prefix. */
    icon: string;
    /** What the row says, or a dash when the restaurant has not filed it. */
    text: string;
    /** i18n key naming the field — the icon's tooltip, and its label when blank. */
    label: string;
    missing: boolean;
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
    reactivate: { isApproved: true, restaurantStatus: 'active' },
};

/**
 * Billing periods are bounded in Vietnam local time server-side
 * (`CreditStatementPeriodCalculator.VietnamTimeZone`), so "has this month
 * closed?" must be asked in the same zone — not the browser's.
 */
const STATEMENT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** One screenful of invoices — the tab lists, the finance screen paginates. */
const INVOICE_PAGE_SIZE = 20;

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
        ApiLabelPipe,
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
        MatTabsModule,
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
    private _transactionRef: MatDialogRef<unknown> | null = null;

    readonly loading = signal(false);
    readonly notFound = signal(false);
    readonly user = signal<AdminUserRow | null>(null);
    readonly credit = signal<AdminRestaurantCredit | null>(null);
    readonly loadingCredit = signal(false);
    readonly statements = signal<AdminCreditStatement[]>([]);
    readonly transactions = signal<AdminCreditTransaction[]>([]);
    /** This restaurant's invoices (`GET /invoices?restaurantId=`). */
    readonly invoices = signal<AdminInvoiceRow[]>([]);
    readonly exportingInvoiceId = signal<string | null>(null);
    readonly loadingCreditHistory = signal(false);
    readonly generatingStatement = signal(false);
    readonly downloadingStatementId = signal<string | null>(null);

    /**
     * The statement opened from the list, re-read by id. The list returns
     * headers only (`CreditStatementSummaryDto`), so the movements that add up
     * to a closing balance — and the due date — exist nowhere else in the UI.
     */
    /** The transaction opened from the list — the row truncates its text. */
    readonly openTransaction = signal<AdminCreditTransaction | null>(null);
    /**
     * The order a charge came from, read when its entry is opened.
     *
     * The ledger says a restaurant was charged 1.2 triệu; what it was charged
     * *for* lives on the order, and `CreditTransactionDto` carries only its id.
     */
    readonly openTransactionOrder = signal<AdminOrderDetail | null>(null);
    readonly loadingTransactionOrder = signal(false);

    readonly openStatement = signal<AdminCreditStatementDetail | null>(null);
    readonly openStatementId = signal<string | null>(null);
    readonly loadingStatement = signal(false);
    readonly statementError = signal<string | null>(null);
    readonly busyAction = signal<RestaurantAction | null>(null);
    readonly editingCreditLimit = signal(false);

    /** A state is a colour as well as a word — see `shared/status-pills`. */
    readonly creditTypePillClass = creditTypePillClass;
    readonly invoiceStatusPillClass = invoiceStatusPillClass;
    readonly orderStatusPillClass = orderStatusPillClass;
    readonly paymentStatusPillClass = paymentStatusPillClass;

    readonly tabs = RESTAURANT_DETAIL_TABS;
    readonly selectedTab = signal(0);
    readonly creditTabLoaded = signal(false);

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
     * How much of the limit is used, 0–100. `null` when there is no limit to
     * be a share of — a restaurant on a limit of 0 cannot order at all, and a
     * bar that reads "100% used" would say the opposite of that.
     */
    readonly creditUsedPercent = computed(() => {
        const limit = this.creditLimit();
        const owed = this.outstandingBalance();
        if (!limit || limit <= 0 || owed === null) {
            return null;
        }
        return Math.max(0, Math.min(100, Math.round((owed / limit) * 100)));
    });

    /** Same bands as the hub capacity meter, so the colours mean one thing. */
    readonly creditMeterClass = computed(() => {
        const used = this.creditUsedPercent() ?? 0;
        if (used >= 90) {
            return 'ff-rd__meter-fill--full';
        }
        return used >= 70
            ? 'ff-rd__meter-fill--tight'
            : 'ff-rd__meter-fill--ok';
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

    private readonly _period = toSignal(this.statementForm.valueChanges, {
        initialValue: this.statementForm.getRawValue(),
    });

    /** The year+month the tab is showing, defaulted to the last closed month. */
    readonly period = computed(() => {
        const value = this._period();
        return {
            year: Number(value.year) || this._latestClosedPeriod.year,
            month: Number(value.month) || this._latestClosedPeriod.month,
        };
    });

    /**
     * The movements of that month. A ledger is read a period at a time, and it
     * is the same period a statement is drawn for — so the list doubles as a
     * preview of what the statement will say.
     */
    readonly periodTransactions = computed(() => {
        const { year, month } = this.period();
        return this.transactions().filter((tx) => {
            const at = DateTime.fromISO(String(tx.createdAt ?? ''), {
                zone: STATEMENT_TIME_ZONE,
            });
            return at.isValid && at.year === year && at.month === month;
        });
    });

    /** The statement already drawn for that period, if there is one. */
    readonly periodStatement = computed(() => {
        const { year, month } = this.period();
        return (
            this.statements().find(
                (st) => st.year === year && st.month === month
            ) ?? null
        );
    });

    /** Years that contain at least one closed period. */
    readonly statementYears = Array.from(
        { length: 6 },
        (_, i) => this._latestClosedPeriod.year - i
    );

    /**
     * Months selectable for the chosen year: every month that has begun. The
     * current one is included — its movements are readable even though its
     * statement cannot be drawn yet, which {@link isStatementPeriodClosed}
     * gates separately.
     */
    availableMonths(): number[] {
        const now = DateTime.now().setZone(STATEMENT_TIME_ZONE);
        const year = this.period().year;
        if (!Number.isFinite(year) || year > now.year) {
            return [];
        }
        const last = year === now.year ? now.month : 12;
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

    selectTab(index: number): void {
        if (this.selectedTab() === index) {
            return;
        }
        this.selectedTab.set(index);
        if (LEDGER_TABS.includes(index)) {
            this._loadCreditTab();
        }
    }

    /** First letter of the restaurant name — the stand-in for a logo. */
    initial(): string {
        return (this.detailTitle().trim()[0] ?? '?').toUpperCase();
    }

    /**
     * The account's photo, when the row carries one. `UserSummaryDto` has no
     * avatar today, so this is normally empty and the initial shows instead —
     * read the same tolerant way as the staff lists, so a DTO that grows one
     * starts working here without a change.
     */
    avatarUrl(): string {
        return String(this.user()?.['avatarUrl'] ?? '').trim();
    }

    /**
     * The account's own status, which is not the restaurant's lifecycle:
     * approving a restaurant never touches `isActive`, and deactivating the
     * account never touches `restaurantStatus`. Both are shown, apart.
     */
    accountActive(): boolean {
        return this.user()?.isActive !== false;
    }

    accountLocked(): boolean {
        return !!this.user()?.lockedUntil;
    }

    /**
     * Lifts a lockout from failed sign-ins (`POST /admin/users/{id}/unlock`).
     * It was reachable only from the users list, which is the wrong place to
     * find it: the restaurant that phoned in about not being able to sign in is
     * the one whose page you are already on.
     */
    unlockAccount(): void {
        const user = this.user();
        if (!user || this.busyAction()) {
            return;
        }
        this.busyAction.set('unlock');
        this._admin
            .unlockUser(user.id)
            .then(() => {
                this.user.update((current) =>
                    current ? { ...current, lockedUntil: null } : current
                );
                this._notify('admin.users.unlock.success');
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.busyAction.set(null));
    }

    /**
     * Enables or disables sign-in (`PATCH /admin/users/{id}/activate`).
     *
     * Switching an account off locks the restaurant out of the platform, so it
     * asks first; switching it back on is the recovery from that and needs no
     * ceremony. Note this is not the restaurant's trading lifecycle — that is
     * `restaurantStatus`, which this endpoint never touches.
     */
    toggleAccountActive(confirmTemplate?: TemplateRef<unknown>): void {
        if (!this.user() || this.busyAction()) {
            return;
        }
        if (this.accountActive() && confirmTemplate) {
            this.openAccountDialog(confirmTemplate);
            return;
        }
        this.setAccountActive(!this.accountActive());
    }

    openAccountDialog(template: TemplateRef<unknown>): void {
        if (this._dialogRef) {
            return;
        }
        this._dialogRef = this._dialog.open(template, {
            autoFocus: 'dialog',
            maxWidth: '95vw',
        });
        this._dialogRef.afterClosed().subscribe(() => {
            this._dialogRef = null;
        });
    }

    setAccountActive(nextActive: boolean): void {
        const user = this.user();
        if (!user || this.busyAction()) {
            return;
        }
        this.closeActionDialog();
        this.busyAction.set('account');
        this._admin
            .setUserActive(user.id, nextActive)
            .then(() => {
                this.user.update((current) =>
                    current ? { ...current, isActive: nextActive } : current
                );
                this._notify(
                    nextActive
                        ? 'admin.users.activate.success'
                        : 'admin.users.deactivate.success'
                );
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.busyAction.set(null));
    }

    /**
     * Back to the users page — restaurants are a tab there now, not a screen of
     * their own. `?role=` lands on that tab rather than "tất cả vai trò".
     */
    goBack(): void {
        void this._router.navigate(['/admin/users'], {
            queryParams: { role: 'restaurant' },
        });
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

    /**
     * Approved and trading. Shown as a tick on the avatar rather than a pill:
     * it is the state most restaurants are in, and a word repeated on every
     * page carries less than a mark the eye can skip.
     */
    isApproved(): boolean {
        return this._status() === 'active';
    }

    /** Signed up and waiting for review — never approved, so never traded. */
    isPending(): boolean {
        return this._status() === 'pending';
    }

    /**
     * A restaurant awaiting review can be approved (BR-AUTH-1) — but only while
     * its account is live. Approving one that cannot sign in leaves it approved
     * and still locked out, which reads as done and is not.
     */
    canApprove(): boolean {
        return this.isPending() && this.accountActive();
    }

    /**
     * Credit is a relationship with a trading restaurant: one still waiting for
     * review has never ordered, owes nothing and has no limit to set. Settling
     * and editing the limit are hidden until it is approved — a suspended one
     * keeps both, because it can still owe money.
     */
    canManageCredit(): boolean {
        return !this.isPending();
    }

    /** Only a suspended restaurant can be put back into service. */
    canReactivate(): boolean {
        return this._status() === 'suspended';
    }

    /**
     * Who and where this restaurant is, one line per fact.
     *
     * Name and approval are the page title and the tick beside it, and the
     * internal id is not something an operator ever reads out — repeating them
     * as label/value rows only made the card longer than what it said. What is
     * left is what someone opening the card actually wants: how to reach the
     * restaurant, where it is, and when it can be collected from.
     */
    profileFields(u: AdminUserRow): ProfileField[] {
        const p = this.profile();
        return [
            {
                icon: 'envelope',
                label: 'admin.restaurants.table.email',
                value: u.email,
            },
            {
                icon: 'phone',
                label: 'admin.restaurants.table.phone',
                value: u.phone,
            },
            {
                icon: 'map-pin',
                label: 'admin.restaurants.legal.address',
                value: p?.address,
            },
        ].map((row) => ({
            icon: row.icon,
            label: row.label,
            text: this._textOrDash(row.value),
            missing: !this._hasText(row.value),
        }));
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

    generateStatement(template: TemplateRef<unknown>): void {
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
            .then(async () => {
                this._notify('admin.restaurants.statements.generateSuccess');
                await this._loadCreditHistory(restaurantId);
                const drawn = this.periodStatement();
                if (drawn) {
                    this.openStatementDetail(drawn, template);
                }
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

    /**
     * Everything the ledger entry carries, ids aside.
     *
     * `CreditTransactionDto` is wider than a table row: the note, the payment
     * method and the reference are exactly what someone reconciling a payment
     * came to read, and none of them fits a column. Built as a list rather than
     * a fixed set of fields so a field the API grows tomorrow still shows up —
     * unknown keys are rendered under their own name rather than dropped.
     *
     * Ids are left out on purpose (the transaction's own, the restaurant's, the
     * order's, the recorder's): a UUID on screen is noise an operator cannot
     * act on, and the page already knows whose ledger this is.
     */
    transactionFields(tx: AdminCreditTransaction): ProfileField[] {
        const known: { key: string; label: string; value: string }[] = [
            {
                key: 'createdAt',
                label: 'admin.restaurants.statements.table.date',
                value: this.formatDateTime(tx.createdAt),
            },
            {
                key: 'amount',
                label: 'admin.restaurants.statements.table.amount',
                value: this._money(tx.amount),
            },
            {
                key: 'balanceAfter',
                label: 'admin.restaurants.statements.table.balance',
                value: this._money(tx.balanceAfter),
            },
            {
                key: 'paymentMethod',
                label: 'admin.restaurants.transactions.paymentMethod',
                value: this._apiLabel(
                    tx.paymentMethod,
                    'admin.restaurants.transactions.method'
                ),
            },
            {
                key: 'reference',
                label: 'admin.restaurants.transactions.reference',
                value: this._textOrDash(tx.reference),
            },
            {
                key: 'note',
                label: 'admin.restaurants.transactions.description',
                value: this._textOrDash(tx.note ?? tx.description),
            },
        ];

        const seen = new Set([
            ...known.map((row) => row.key),
            // The type is the dialog's headline, and ids are not shown.
            'type',
            'description',
            'id',
            'transactionId',
            'restaurantId',
            'orderId',
            'recordedByUserId',
        ]);
        const extras = Object.entries(tx)
            .filter(
                ([key, value]) =>
                    !seen.has(key) &&
                    !/id$/i.test(key) &&
                    value !== null &&
                    value !== undefined &&
                    value !== '' &&
                    typeof value !== 'object'
            )
            .map(([key, value]) => ({
                icon: '',
                label: key,
                text: String(value),
                missing: false,
            }));

        return [
            ...known.map((row) => ({
                icon: '',
                label: this._transloco.translate(row.label),
                text: row.value,
                missing: row.value === '—',
            })),
            ...extras,
        ];
    }

    /** VND, grouped — the dialog prints amounts as text, not through a pipe. */
    private _money(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        const amount = Number(value);
        return Number.isFinite(amount)
            ? `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`
            : '—';
    }

    /** `<prefix>.<value>`, falling through to the value — see `ApiLabelPipe`. */
    private _apiLabel(value: unknown, prefix: string): string {
        const raw = String(value ?? '').trim();
        if (!raw) {
            return '—';
        }
        const label = this._transloco.translate(
            `${prefix}.${raw.toLowerCase()}`
        );
        return label && !label.startsWith(prefix) ? label : raw;
    }

    /**
     * Opens one ledger entry in full. There is no per-transaction endpoint —
     * the row already holds everything the list returned.
     */
    openTransactionDetail(
        transaction: AdminCreditTransaction,
        template: TemplateRef<unknown>
    ): void {
        if (this._transactionRef) {
            return;
        }
        this.openTransaction.set(transaction);
        this.openTransactionOrder.set(null);
        this._transactionRef = this._dialog.open(template, {
            autoFocus: 'dialog',
            maxWidth: '95vw',
        });
        this._transactionRef.afterClosed().subscribe(() => {
            this._transactionRef = null;
            this.openTransaction.set(null);
            this.openTransactionOrder.set(null);
        });

        const orderId = String(transaction.orderId ?? '').trim();
        if (!orderId) {
            return;
        }
        this.loadingTransactionOrder.set(true);
        this._admin
            .getOrder(orderId)
            .then((order) => {
                // The dialog may have been closed, or moved to another entry,
                // while this was in flight.
                if (this.openTransaction()?.id === transaction.id) {
                    this.openTransactionOrder.set(order);
                }
            })
            // A missing or forbidden order leaves the section out rather than
            // failing the entry the operator actually asked for.
            .catch(() => this.openTransactionOrder.set(null))
            .finally(() => this.loadingTransactionOrder.set(false));
    }

    /** Lines of the order behind the open entry, in the order the API sent. */
    orderItems(order: AdminOrderDetail): AdminOrderItem[] {
        return Array.isArray(order.items) ? order.items : [];
    }

    closeTransactionDetail(): void {
        this._transactionRef?.close();
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

    /**
     * Downloads an invoice's e-invoice XML (`GET /invoices/{id}/export`). The
     * invoices screen has this; a restaurant's own invoices are part of what
     * "công nợ" means, so they are readable from here rather than only through
     * a filter two screens away.
     */
    exportInvoice(invoice: AdminInvoiceRow): void {
        if (!invoice.id || this.exportingInvoiceId()) {
            return;
        }
        this.exportingInvoiceId.set(invoice.id);
        this._admin
            .exportInvoice(invoice.id)
            .then(({ blob, fileName }) => {
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = fileName;
                anchor.click();
                URL.revokeObjectURL(url);
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.exportingInvoiceId.set(null));
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
        // Statements, transactions and invoices belong to the two money tabs
        // and are read when one is first opened — the header only needs the
        // snapshot.
        this.creditTabLoaded.set(false);
        if (LEDGER_TABS.includes(this.selectedTab())) {
            this._loadCreditTab();
        }
    }

    /** Reads the credit history once, the first time the tab is shown. */
    private _loadCreditTab(): void {
        const restaurantId = this.user()?.restaurantId;
        if (!restaurantId || this.creditTabLoaded()) {
            return;
        }
        this.creditTabLoaded.set(true);
        this._loadCreditHistory(restaurantId);
    }

    private _loadCreditHistory(restaurantId: string): Promise<void> {
        this.loadingCreditHistory.set(true);
        return Promise.all([
            this._admin.getCreditStatements(restaurantId),
            this._admin.getCreditTransactions(restaurantId),
            // Invoices are a separate endpoint and a separate failure: a 403
            // there should not blank the statements beside it.
            this._admin
                .getInvoices({ restaurantId, pageSize: INVOICE_PAGE_SIZE })
                .then((result) => result.invoices)
                .catch(() => []),
        ])
            .then(([statements, transactions, invoices]) => {
                // Newest period, movement and invoice first — a ledger is read
                // from the top, and none of these endpoints promises an order.
                this.statements.set(newestActiveFirst(statements));
                this.transactions.set(newestActiveFirst(transactions));
                this.invoices.set(newestActiveFirst(invoices));
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
