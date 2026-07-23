import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    WritableSignal,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AdminService, apiErrorMessage } from '../admin.service';
import {
    AdminCreditStatement,
    AdminCreditTransaction,
    AdminRestaurantCredit,
} from '../admin.types';

/** UUID v4-ish check — good enough to short-circuit obviously malformed input. */
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Admin ▸ Restaurants. There is no `GET /admin/restaurants` list endpoint,
 * so the admin looks up a restaurant by pasting its id and drives approval
 * and credit operations directly against it.
 */
@Component({
    selector: 'admin-restaurants-admin',
    templateUrl: './restaurants-admin.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    // Full-width flex host so the page fills the screen (see ResourceCrudComponent).
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class RestaurantsAdminComponent {
    private readonly _admin = inject(AdminService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);

    readonly credit = signal<AdminRestaurantCredit | null>(null);
    readonly loadingCredit = signal(false);
    readonly approving = signal(false);
    readonly suspending = signal(false);
    readonly reactivating = signal(false);
    readonly settingLimit = signal(false);
    readonly settling = signal(false);

    /** True once a valid restaurant id has been looked up (reveals the ledger). */
    readonly lookedUp = signal(false);
    readonly statements = signal<AdminCreditStatement[]>([]);
    readonly transactions = signal<AdminCreditTransaction[]>([]);
    readonly loadingLedger = signal(false);
    readonly generating = signal(false);
    /** Statement id whose PDF is currently being fetched, or null. */
    readonly pdfBusyId = signal<string | null>(null);

    readonly lookupForm = this._formBuilder.nonNullable.group({
        restaurantId: [
            '',
            [Validators.required, Validators.pattern(UUID_PATTERN)],
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

    readonly generateForm = this._formBuilder.nonNullable.group({
        year: [
            new Date().getFullYear(),
            [Validators.required, Validators.min(2000)],
        ],
        month: [
            new Date().getMonth() + 1,
            [Validators.required, Validators.min(1), Validators.max(12)],
        ],
    });

    get restaurantId(): string {
        return this.lookupForm.getRawValue().restaurantId;
    }

    private get _validRestaurantId(): string | null {
        this.lookupForm.markAllAsTouched();
        return this.lookupForm.valid ? this.restaurantId : null;
    }

    lookupCredit(): void {
        const restaurantId = this._validRestaurantId;
        if (!restaurantId) {
            return;
        }
        this.lookedUp.set(true);
        this.loadingCredit.set(true);
        this._admin
            .getRestaurantCredit(restaurantId)
            .then((credit) => this.credit.set(credit))
            .finally(() => this.loadingCredit.set(false));
        this._loadLedger(restaurantId);
    }

    /** Loads the statements + transactions for the looked-up restaurant. */
    private _loadLedger(restaurantId: string): void {
        this.loadingLedger.set(true);
        Promise.all([
            this._admin.getCreditStatements(restaurantId),
            this._admin.getCreditTransactions(restaurantId),
        ])
            .then(([statements, transactions]) => {
                this.statements.set(statements);
                this.transactions.set(transactions);
            })
            .finally(() => this.loadingLedger.set(false));
    }

    generateStatement(): void {
        const restaurantId = this._validRestaurantId;
        if (!restaurantId || this.generateForm.invalid) {
            this.generateForm.markAllAsTouched();
            return;
        }
        const { year, month } = this.generateForm.getRawValue();
        this.generating.set(true);
        this._admin
            .generateCreditStatement(restaurantId, { year, month })
            .then(() => {
                this._notify('admin.restaurants.statements.generateSuccess');
                this._loadLedger(restaurantId);
            })
            .catch(async (err) =>
                this._notifyText(
                    (await apiErrorMessage(err)) ??
                        this._transloco.translate(
                            'admin.restaurants.actionError'
                        )
                )
            )
            .finally(() => this.generating.set(false));
    }

    /** Fetches a statement's PDF and opens it in a new tab. */
    downloadStatementPdf(statementId: string): void {
        const restaurantId = this._validRestaurantId;
        if (!restaurantId) {
            return;
        }
        this.pdfBusyId.set(statementId);
        this._admin
            .getStatementPdf(restaurantId, statementId)
            .then((blob) => {
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                // Revoke later so the opened tab has time to render the PDF.
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            })
            .catch(async (err) =>
                this._notifyText(
                    (await apiErrorMessage(err)) ??
                        this._transloco.translate(
                            'admin.restaurants.actionError'
                        )
                )
            )
            .finally(() => this.pdfBusyId.set(null));
    }

    trackById(_: number, row: { id: string }): string {
        return row.id;
    }

    approve(): void {
        this._runLifecycleAction(
            this.approving,
            (id) => this._admin.approveRestaurant(id),
            'admin.restaurants.approve.success'
        );
    }

    suspend(): void {
        this._runLifecycleAction(
            this.suspending,
            (id) => this._admin.suspendRestaurant(id),
            'admin.restaurants.suspend.success'
        );
    }

    reactivate(): void {
        this._runLifecycleAction(
            this.reactivating,
            (id) => this._admin.reactivateRestaurant(id),
            'admin.restaurants.reactivate.success'
        );
    }

    /**
     * Shared runner for the approve/suspend/reactivate buttons: validates the
     * looked-up id, toggles the button's own busy flag, and reports the outcome.
     */
    private _runLifecycleAction(
        busy: WritableSignal<boolean>,
        action: (restaurantId: string) => Promise<void>,
        successKey: string
    ): void {
        const restaurantId = this._validRestaurantId;
        if (!restaurantId) {
            return;
        }
        busy.set(true);
        action(restaurantId)
            .then(() => {
                this._notify(successKey);
                // Approval/suspension can change the credit record this page is
                // showing, so refresh it instead of leaving a pre-action value.
                if (this.credit()) {
                    this.lookupCredit();
                }
            })
            .catch(async (err) =>
                this._notifyText(
                    (await apiErrorMessage(err)) ??
                        this._transloco.translate(
                            'admin.restaurants.actionError'
                        )
                )
            )
            .finally(() => busy.set(false));
    }

    setCreditLimit(): void {
        const restaurantId = this._validRestaurantId;
        if (!restaurantId || this.creditLimitForm.invalid) {
            this.creditLimitForm.markAllAsTouched();
            return;
        }
        const { creditLimit, note } = this.creditLimitForm.getRawValue();
        this.settingLimit.set(true);
        this._admin
            .setCreditLimit(restaurantId, {
                creditLimit,
                note: note || null,
            })
            .then(() => {
                this._notify('admin.restaurants.creditLimit.success');
                this.lookupCredit();
            })
            .catch(() => this._notify('admin.restaurants.actionError'))
            .finally(() => this.settingLimit.set(false));
    }

    settleCredit(): void {
        const restaurantId = this._validRestaurantId;
        if (!restaurantId || this.settleForm.invalid) {
            this.settleForm.markAllAsTouched();
            return;
        }
        const { amount, paymentMethod, reference, note } =
            this.settleForm.getRawValue();
        this.settling.set(true);
        this._admin
            .settleCredit(restaurantId, {
                amount,
                paymentMethod: paymentMethod || null,
                reference: reference || null,
                note: note || null,
            })
            .then(() => {
                this._notify('admin.restaurants.settle.success');
                this.settleForm.reset({
                    amount: 0,
                    paymentMethod: '',
                    reference: '',
                    note: '',
                });
                this.lookupCredit();
            })
            .catch(() => this._notify('admin.restaurants.actionError'))
            .finally(() => this.settling.set(false));
    }

    private _notify(key: string): void {
        this._notifyText(this._transloco.translate(key));
    }

    private _notifyText(message: string): void {
        this._snackBar.open(message, undefined, { duration: 3000 });
    }
}
