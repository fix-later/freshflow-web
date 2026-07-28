import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import {
    FormBuilder,
    FormGroupDirective,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    EMAIL_MAX_LENGTH,
    passwordStrengthValidator,
    phoneNumberValidator,
} from 'app/core/api/validators';
import { AdminService } from '../admin.service';

const RESTAURANT_ROLE = 'restaurant';
const RESTAURANT_NAME_MAX_LENGTH = 200;
const PHONE_MAX_LENGTH = 20;

/** Admin ▸ Restaurants ▸ New — full-page create form. */
@Component({
    selector: 'admin-restaurants-create',
    templateUrl: './restaurants-create.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
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
export class RestaurantsCreateComponent {
    private readonly _admin = inject(AdminService);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);

    readonly saving = signal(false);

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

    goBack(): void {
        void this._router.navigate(['/admin/restaurants']);
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

    createRestaurant(ngForm: FormGroupDirective): void {
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
                role: RESTAURANT_ROLE,
                marketId: null,
                restaurantName: value.restaurantName.trim() || null,
                phone: value.phone.trim() || null,
            })
            .then(() => {
                this._notify('admin.restaurants.create.success');
                this.goBack();
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
            .finally(() => {
                this.saving.set(false);
                ngForm.form.markAsPristine();
            });
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
