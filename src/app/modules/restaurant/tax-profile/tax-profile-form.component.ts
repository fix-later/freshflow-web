import {
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    inject,
    input,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
    LEGAL_NAME_MAX_LENGTH,
    nonBlankValidator,
    TAX_ADDRESS_MAX_LENGTH,
    TAX_CODE_MAX_LENGTH,
    TAX_EMAIL_MAX_LENGTH,
    taxCodeValidator,
    trimmedMaxLengthValidator,
} from 'app/core/api/validators';
import { UpdateTaxProfileRequest } from 'contract';
import { RestaurantProfileService } from '../restaurant-profile.service';

/**
 * Restaurant tax-profile editor: tax code, legal (invoicing) name, billing
 * address, and billing email — used to generate correct VAT invoices.
 * `PUT /restaurants/me/tax-profile` has no matching GET, but the saved values
 * come back on `GET /restaurants/me/profile`, so the form opens filled in.
 */
@Component({
    selector: 'tax-profile-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './tax-profile-form.component.html',
    styleUrl: './tax-profile-form.component.scss',
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSnackBarModule,
        TranslocoModule,
    ],
})
export class TaxProfileFormComponent implements OnInit {
    private readonly _fb = inject(FormBuilder);
    private readonly _service = inject(RestaurantProfileService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    /**
     * Hides this form's own save button. The onboarding wizard drives the
     * save from its Continue action, so a second submit inside the step
     * would be two buttons for one outcome.
     */
    readonly hideActions = input(false, { transform: booleanAttribute });
    readonly saving = signal(false);
    readonly loading = signal(false);
    /** Localized reason a write failed when it wasn't a per-field rejection. */
    readonly formError = signal<string | null>(null);
    /** Localized reason the pre-fill read failed — the form still opens. */
    readonly loadError = signal<string | null>(null);

    /** Template helpers for per-field messages. */
    readonly errorKey = fieldErrorKey;
    readonly maxLength = fieldMaxLength;
    readonly serverMessage = serverError;

    /**
     * Mirrors `UpdateMyTaxProfileCommandValidator` rule for rule.
     *
     * Tax code, legal name and address are `NotEmpty()` there — the request
     * model's nullable strings say otherwise, and sending a blank one answered
     * 400 with "'Tax Code' must not be empty." Only the billing email is
     * genuinely optional (`When(x => x.Email is not null)`).
     */
    readonly form = this._fb.group({
        taxCode: this._fb.control<string | null>(null, [
            Validators.required,
            nonBlankValidator,
            // `Matches(@"^\d{10}(-\d{3})?$")` — the rule the doc omits entirely.
            taxCodeValidator,
            trimmedMaxLengthValidator(TAX_CODE_MAX_LENGTH),
        ]),
        legalName: this._fb.control<string | null>(null, [
            Validators.required,
            nonBlankValidator,
            trimmedMaxLengthValidator(LEGAL_NAME_MAX_LENGTH),
        ]),
        address: this._fb.control<string | null>(null, [
            Validators.required,
            nonBlankValidator,
            trimmedMaxLengthValidator(TAX_ADDRESS_MAX_LENGTH),
        ]),
        email: this._fb.control<string | null>(null, [
            Validators.email,
            trimmedMaxLengthValidator(TAX_EMAIL_MAX_LENGTH),
        ]),
    });

    async ngOnInit(): Promise<void> {
        await this.reload();
    }

    /** Loads the saved values into the form; also the retry action. */
    async reload(): Promise<void> {
        this.loading.set(true);
        this.loadError.set(null);
        try {
            const saved = await this._service.loadTaxProfile();
            this.form.reset({
                taxCode: saved.taxCode ?? null,
                legalName: saved.legalName ?? null,
                address: saved.address ?? null,
                email: saved.email ?? null,
            });
        } catch (err) {
            // A failed pre-fill must not block editing — say so and carry on.
            this.loadError.set(
                await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'restaurantProfile.taxProfile.loadError'
                )
            );
        } finally {
            this.loading.set(false);
        }
    }

    /** Persist the tax profile. Resolves `true` when the write succeeded. */
    async save(): Promise<boolean> {
        clearServerErrors(this.form);
        this.formError.set(null);
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return false;
        }
        const v = this.form.getRawValue();
        const payload: UpdateTaxProfileRequest = {
            taxCode: emptyToNull(v.taxCode),
            legalName: emptyToNull(v.legalName),
            address: emptyToNull(v.address),
            email: emptyToNull(v.email),
        };

        this.saving.set(true);
        try {
            await this._service.saveTaxProfile(payload);
            this._toast('restaurantProfile.taxProfile.saved');
            return true;
        } catch (err) {
            const translate = (key: string): string =>
                this._transloco.translate(key);
            const { handled } = await applyApiErrorToForm(
                this.form,
                err,
                translate
            );
            this.formError.set(
                handled
                    ? translate('errors.api.validation')
                    : await describeApiError(
                          err,
                          translate,
                          'restaurantProfile.taxProfile.saveError'
                      )
            );
            return false;
        } finally {
            this.saving.set(false);
        }
    }

    private _toast(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }
}

/** Blank strings become null so unset fields are cleared, not stored empty. */
function emptyToNull(value: string | null): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed === '' ? null : trimmed;
}
