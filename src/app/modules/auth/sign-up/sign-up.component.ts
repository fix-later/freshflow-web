import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import {
    FormBuilder,
    FormsModule,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { FuseAlertComponent, FuseAlertType } from '@fuse/components/alert';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { readApiError } from 'app/core/api/envelope';
import {
    API_MESSAGE_TEXT_KEYS,
    describeApiError,
} from 'app/core/api/error-codes';
import {
    EMAIL_MAX_LENGTH,
    nonBlankValidator,
    passwordStrengthValidator,
    phoneNumberValidator,
} from 'app/core/api/validators';
import { AuthService } from 'app/core/auth/auth.service';
import { AuthBrandPanelComponent } from 'app/modules/auth/brand-panel/auth-brand-panel.component';

/** `restaurantName` max 200, `phone` max 20 — `docs/04-api-design.md` §6. */
const RESTAURANT_NAME_MAX_LENGTH = 200;
const PHONE_MAX_LENGTH = 20;

/** The password rules shown as a live checklist, in policy order. */
const PASSWORD_RULES = ['minLength', 'uppercase', 'digit', 'special'] as const;

/** Backend `details[].field` → form control. Lower-cased: .NET may PascalCase. */
const FIELD_TO_CONTROL: Readonly<Record<string, string>> = {
    email: 'email',
    password: 'password',
    restaurantname: 'restaurantName',
    phone: 'phone',
};

/**
 * Restaurant self-registration (UC-AUTH-11, `POST /api/v1/auth/register`).
 *
 * Every rule the backend enforces is mirrored here so invalid input is caught
 * before a request is sent (`docs/04-api-design.md` §6):
 *
 * | Field            | Rule                                                    |
 * |------------------|---------------------------------------------------------|
 * | `email`          | required (non-blank), valid format, ≤ 255 chars         |
 * | `password`       | required, ≥ 8 chars, ≥1 uppercase, ≥1 digit, ≥1 special |
 * | `restaurantName` | required (non-blank), ≤ 200 chars                       |
 * | `phone`          | **optional**; `^\+?[0-9]{7,15}$`, ≤ 20 chars            |
 *
 * Documented + implemented failure codes surfaced in the UI:
 * - `EMAIL_ALREADY_EXISTS` (409) — field error + sign-in CTA
 * - `PHONE_ALREADY_EXISTS` (409) — field error on phone
 * - `VALIDATION_ERROR` (400) — `details[]` on the matching controls
 * - `WEAK_PASSWORD` (400) — password field
 * - network / 429 / 5xx — banner via {@link describeApiError}
 */
@Component({
    selector: 'auth-sign-up',
    templateUrl: './sign-up.component.html',
    styleUrl: './sign-up.component.scss',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        RouterLink,
        FuseAlertComponent,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        TranslocoModule,
        AuthBrandPanelComponent,
    ],
})
export class AuthSignUpComponent {
    private readonly _authService = inject(AuthService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);

    readonly passwordRules = PASSWORD_RULES;
    readonly emailMaxLength = EMAIL_MAX_LENGTH;
    readonly restaurantNameMaxLength = RESTAURANT_NAME_MAX_LENGTH;
    readonly phoneMaxLength = PHONE_MAX_LENGTH;

    readonly submitting = signal(false);
    readonly alert = signal<{ type: FuseAlertType; message: string } | null>(
        null
    );
    /** Set when the backend says the email is taken, so the UI can offer sign-in. */
    readonly emailTaken = signal(false);

    readonly signUpForm = this._formBuilder.nonNullable.group({
        restaurantName: [
            '',
            [
                nonBlankValidator,
                Validators.maxLength(RESTAURANT_NAME_MAX_LENGTH),
            ],
        ],
        email: [
            '',
            [
                nonBlankValidator,
                Validators.email,
                Validators.maxLength(EMAIL_MAX_LENGTH),
            ],
        ],
        // Optional per the contract — omit empty rather than send "".
        phone: [
            '',
            [phoneNumberValidator, Validators.maxLength(PHONE_MAX_LENGTH)],
        ],
        password: ['', [nonBlankValidator, passwordStrengthValidator]],
        agreements: [false, Validators.requiredTrue],
    });

    /** True while `rule` is not yet satisfied, for the live checklist. */
    passwordRuleFailing(rule: string): boolean {
        const control = this.signUpForm.controls.password;
        if (!control.value) {
            return true;
        }
        const strength = control.errors?.['passwordStrength'] as
            | Record<string, boolean>
            | undefined;
        return strength ? !!strength[rule] : false;
    }

    async signUp(): Promise<void> {
        if (this.submitting()) {
            return;
        }

        // Show every problem at once rather than one per attempt.
        if (this.signUpForm.invalid) {
            this.signUpForm.markAllAsTouched();
            this.alert.set({
                type: 'error',
                message: this._transloco.translate(
                    'auth.signUp.formFieldsBelow'
                ),
            });
            return;
        }

        this.alert.set(null);
        this.emailTaken.set(false);
        this.submitting.set(true);
        this.signUpForm.disable();

        const { restaurantName, email, phone, password } =
            this.signUpForm.getRawValue();
        const trimmedEmail = email.trim();

        try {
            await this._authService.signUp({
                restaurantName: restaurantName.trim(),
                email: trimmedEmail,
                password,
                // Omit rather than send "" — empty string fails the BE pattern.
                phone: phone.trim() || undefined,
            });

            // Carry the address forward so the verification screen can submit
            // and resend codes without asking for it again.
            await this._router.navigate(['/confirmation-required'], {
                queryParams: { email: trimmedEmail },
            });
        } catch (err) {
            this.signUpForm.enable();
            await this._handleFailure(err);
        } finally {
            this.submitting.set(false);
        }
    }

    /**
     * Turns any documented failure into something on screen: `details[]` become
     * inline field errors, conflict codes flag the relevant field, and
     * everything else becomes a specific banner message.
     */
    private async _handleFailure(err: unknown): Promise<void> {
        const info = await readApiError(err);

        if (info?.fieldErrors) {
            this._applyFieldErrors(info.fieldErrors);
        }

        // 409 — email already registered; offer sign-in.
        if (info?.code === 'EMAIL_ALREADY_EXISTS') {
            this.emailTaken.set(true);
            this.signUpForm.controls.email.setErrors({
                server: this._transloco.translate(
                    'errors.api.emailAlreadyExists'
                ),
            });
            this.signUpForm.controls.email.markAsTouched();
        }

        // 409 — phone already registered (implemented on BE even though the
        // design table only lists EMAIL_ALREADY_EXISTS for /register).
        if (info?.code === 'PHONE_ALREADY_EXISTS') {
            this.signUpForm.controls.phone.setErrors({
                server: this._transloco.translate(
                    'errors.api.phoneAlreadyExists'
                ),
            });
            this.signUpForm.controls.phone.markAsTouched();
        }

        // 400 WEAK_PASSWORD — client validator should have caught this; point
        // at the field if policies drifted.
        if (info?.code === 'WEAK_PASSWORD') {
            this.signUpForm.controls.password.setErrors({
                server: this._transloco.translate('errors.api.weakPassword'),
            });
            this.signUpForm.controls.password.markAsTouched();
        }

        this.alert.set({
            type: 'error',
            message: await describeApiError(
                err,
                (key) => this._transloco.translate(key),
                'auth.errors.generic'
            ),
        });
    }

    /**
     * Puts each `details[]` entry on the control that caused it, localized where
     * the message is one the doc / FluentValidation specifies.
     */
    private _applyFieldErrors(fieldErrors: Record<string, string>): void {
        for (const [field, message] of Object.entries(fieldErrors)) {
            const controlName = FIELD_TO_CONTROL[field.trim().toLowerCase()];
            if (!controlName) {
                continue;
            }
            const control = this.signUpForm.get(controlName);
            if (!control) {
                continue;
            }
            const key = API_MESSAGE_TEXT_KEYS[message.trim()];
            control.setErrors({
                server: key ? this._transloco.translate(key) : message,
            });
            control.markAsTouched();
        }
    }
}
