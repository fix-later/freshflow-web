import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnInit,
    ViewEncapsulation,
    computed,
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
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    EMAIL_MAX_LENGTH,
    passwordStrengthValidator,
    phoneNumberValidator,
} from 'app/core/api/validators';
import { RoleLabelPipe } from 'app/core/i18n/role-label.pipe';
import { AdminService } from '../admin.service';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';

const AGENT_ROLES = ['market_agent', 'kiosk_staff'];
const RESTAURANT_ROLE = 'restaurant';
const HUB_STAFF_ROLE = 'hub_staff';
const RESTAURANT_NAME_MAX_LENGTH = 200;
/** `CreateUserCommandValidator.FullName` — `MaximumLength(200)`. */
const FULL_NAME_MAX_LENGTH = 200;
const PHONE_MAX_LENGTH = 20;

/** Admin ▸ Users ▸ New — the create form, shown as a dialog from the list. */
@Component({
    selector: 'admin-users-create',
    templateUrl: './users-create.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        RoleLabelPipe,
        TranslocoModule,
    ],
})
export class UsersCreateComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _dialogRef =
        inject<MatDialogRef<UsersCreateComponent, boolean>>(MatDialogRef);
    /** Optional `{ role }` from the caller — see `_loadRoles`. */
    private readonly _data = inject<{ role?: string } | null>(MAT_DIALOG_DATA, {
        optional: true,
    });
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _destroyRef = inject(DestroyRef);

    readonly saving = signal(false);
    readonly roles = signal<string[]>([]);
    readonly markets = signal<{ id: string; name: string }[]>([]);
    readonly hubs = signal<{ id: string; name: string }[]>([]);
    readonly selectedRole = signal('');

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
        fullName: ['', Validators.maxLength(FULL_NAME_MAX_LENGTH)],
        marketId: [''],
        hubId: [''],
        restaurantName: ['', Validators.maxLength(RESTAURANT_NAME_MAX_LENGTH)],
        phone: [
            '',
            [phoneNumberValidator, Validators.maxLength(PHONE_MAX_LENGTH)],
        ],
    });

    readonly needsMarket = computed(() =>
        AGENT_ROLES.includes(this.selectedRole())
    );
    readonly needsHub = computed(() => this.selectedRole() === HUB_STAFF_ROLE);
    readonly needsRestaurantName = computed(
        () => this.selectedRole() === RESTAURANT_ROLE
    );

    ngOnInit(): void {
        this._loadRoles();
        this._loadMarkets();
        this._loadHubs();
        this.createForm.controls.role.valueChanges
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe((role) => this._applyRoleValidators(role));
    }

    /** Closes the dialog; `true` tells the list a user was created. */
    close(created = false): void {
        this._dialogRef.close(created);
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

    createUser(ngForm: FormGroupDirective): void {
        if (this.createForm.invalid) {
            this.createForm.markAllAsTouched();
            return;
        }
        const value = this.createForm.getRawValue();
        this.saving.set(true);
        this.createForm.disable();
        this._admin
            .createUser({
                email: value.email.trim(),
                password: value.password,
                role: value.role,
                fullName: value.fullName.trim() || null,
                marketId: this.needsMarket() ? value.marketId || null : null,
                restaurantName: this.needsRestaurantName()
                    ? value.restaurantName.trim() || null
                    : null,
                phone: value.phone.trim() || null,
            })
            .then(async (userId) => {
                const hubId = this.needsHub() ? value.hubId : '';
                if (hubId && userId) {
                    await this._assignToHub(hubId, userId);
                } else {
                    this._notify('admin.users.create.success');
                }
                this.close(true);
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
            .finally(() => {
                this.saving.set(false);
                ngForm.form.markAsPristine();
            });
    }

    /**
     * Adds the freshly created account to `hubId`'s roster. The create endpoint
     * takes a `marketId` but no `hubId`, so the hub side rides on the same
     * replace-the-roster call the hub edit page uses: read the current staff,
     * then write it back with the new user appended.
     *
     * The account already exists at this point, so a failure here is reported
     * as "created, but not assigned" rather than as a failed creation — the
     * admin can finish the assignment from Admin ▸ Logistics ▸ Hubs.
     */
    private async _assignToHub(hubId: string, userId: string): Promise<void> {
        try {
            const staffIds =
                await this._logistics.getHubStaffAssignments(hubId);
            await this._logistics.replaceHubStaffAssignments(
                hubId,
                staffIds.includes(userId) ? staffIds : [...staffIds, userId]
            );
            this._notify('admin.users.create.success');
        } catch (err) {
            this._notifyText(
                await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'admin.users.create.errors.hubAssignFailed'
                )
            );
        }
    }

    private _applyRoleValidators(role: string): void {
        this.selectedRole.set(role);
        const market = this.createForm.controls.marketId;
        const hub = this.createForm.controls.hubId;
        const restaurantName = this.createForm.controls.restaurantName;
        market.setValidators(
            AGENT_ROLES.includes(role) ? [Validators.required] : []
        );
        hub.setValidators(role === HUB_STAFF_ROLE ? [Validators.required] : []);
        restaurantName.setValidators(
            role === RESTAURANT_ROLE
                ? [
                      Validators.required,
                      Validators.maxLength(RESTAURANT_NAME_MAX_LENGTH),
                  ]
                : [Validators.maxLength(RESTAURANT_NAME_MAX_LENGTH)]
        );
        market.updateValueAndValidity();
        hub.updateValueAndValidity();
        restaurantName.updateValueAndValidity();
    }

    /**
     * A caller can preselect the role through `MAT_DIALOG_DATA` — a screen
     * that knows which kind of account it needs hands the job over without the
     * admin picking it again. Applied only if the backend really offers that
     * role, so a stale caller cannot submit an invalid one.
     */
    private _loadRoles(): void {
        this._admin
            .getRoles()
            .then((roles) => {
                this.roles.set(roles);
                const wanted = this._data?.role;
                if (wanted && roles.includes(wanted)) {
                    this.createForm.controls.role.setValue(wanted);
                }
            })
            .catch(() => this.roles.set([]));
    }

    private _loadMarkets(): void {
        this._admin
            .getMarkets()
            .then((markets) =>
                this.markets.set(
                    markets.map((m) => ({
                        id: String(m.id),
                        name: String(m.name ?? ''),
                    }))
                )
            )
            .catch(() => this.markets.set([]));
    }

    private _loadHubs(): void {
        this._admin
            .getHubs()
            .then((hubs) => this.hubs.set(hubs))
            .catch(() => this.hubs.set([]));
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    private _notifyText(message: string): void {
        this._snackBar.open(message, undefined, { duration: 5000 });
    }
}
