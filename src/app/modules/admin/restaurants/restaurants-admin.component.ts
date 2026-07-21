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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AdminService, apiErrorMessage } from '../admin.service';
import { AdminRestaurantCredit } from '../admin.types';

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
        this.loadingCredit.set(true);
        this._admin
            .getRestaurantCredit(restaurantId)
            .then((credit) => this.credit.set(credit))
            .finally(() => this.loadingCredit.set(false));
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
