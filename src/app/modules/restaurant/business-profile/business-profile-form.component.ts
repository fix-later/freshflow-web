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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
    isImageFile,
    isUploadedImageUrl,
    uploadSignedImage,
} from 'app/core/api/cloudinary-upload';
import { describeApiError } from 'app/core/api/error-codes';
import {
    applyApiErrorToForm,
    clearServerErrors,
    fieldErrorKey,
    fieldMaxLength,
    serverError,
} from 'app/core/api/form-errors';
import {
    absoluteHttpUrlValidator,
    CONTACT_PERSON_MAX_LENGTH,
    nonBlankValidator,
    RESTAURANT_ADDRESS_MAX_LENGTH,
    RESTAURANT_NAME_MAX_LENGTH,
    trimmedMaxLengthValidator,
    URL_MAX_LENGTH,
} from 'app/core/api/validators';
import { ApprovalBannerComponent } from 'app/core/auth/components/approval-banner.component';
import { restaurantProfileApi, UpdateRestaurantProfileRequest } from 'contract';
import { RestaurantProfileService } from '../restaurant-profile.service';

/**
 * Restaurant business-profile editor (spec US1): name, address, and contact
 * person, with an inline approval-status notice for accounts that are not yet
 * approved.
 *
 * The receiving-window ("giờ nhận hàng") fields this form used to expose are
 * retired: every delivery — one-off or recurring — now arrives in the same
 * fixed early-morning window (see `checkout.component.ts`'s `DELIVERY_HOUR`),
 * so there is nothing left for a restaurant to declare. Any `pickupStart`/
 * `pickupEnd` a restaurant configured previously is preserved as-is (passed
 * through unchanged on save, never surfaced in this form) rather than nulled
 * out — the backend still overwrites both on every profile update, so
 * dropping them from the payload would silently erase that historical data.
 */
@Component({
    selector: 'business-profile-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './business-profile-form.component.html',
    styleUrl: './business-profile-form.component.scss',
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        MatSnackBarModule,
        TranslocoModule,
        ApprovalBannerComponent,
    ],
})
export class BusinessProfileFormComponent implements OnInit {
    private readonly _fb = inject(FormBuilder);
    private readonly _service = inject(RestaurantProfileService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    readonly loading = signal(false);
    /**
     * Hides this form's own save button. The onboarding wizard drives the
     * save from its Continue action, so a second submit inside the step
     * would be two buttons for one outcome.
     */
    readonly hideActions = input(false, { transform: booleanAttribute });
    readonly saving = signal(false);
    readonly uploading = signal(false);
    /** Localized reason the read failed — drives the retryable error state. */
    readonly loadError = signal<string | null>(null);
    /** Localized reason a write failed when it wasn't a per-field rejection. */
    readonly formError = signal<string | null>(null);

    /** Template helpers for per-field messages. */
    readonly errorKey = fieldErrorKey;
    readonly maxLength = fieldMaxLength;
    readonly serverMessage = serverError;
    readonly nameMaxLength = RESTAURANT_NAME_MAX_LENGTH;

    readonly form = this._fb.group({
        // `minLength 1, maxLength 200` on the request model; `NotEmpty`
        // rejects a blank string, which `Validators.required` accepts.
        name: this._fb.control('', {
            validators: [
                Validators.required,
                nonBlankValidator,
                trimmedMaxLengthValidator(RESTAURANT_NAME_MAX_LENGTH),
            ],
            nonNullable: true,
        }),
        // `MaximumLength(500)` / `MaximumLength(200)` on the same validator —
        // unbounded here until now, so an over-long address was only rejected
        // by the server, after the save button had already been pressed.
        address: this._fb.control<string | null>(null, [
            trimmedMaxLengthValidator(RESTAURANT_ADDRESS_MAX_LENGTH),
        ]),
        contactPerson: this._fb.control<string | null>(null, [
            trimmedMaxLengthValidator(CONTACT_PERSON_MAX_LENGTH),
        ]),
        /**
         * Filled by the Cloudinary upload below, so the format rule
         * (`Uri.TryCreate(…, Absolute)` + `MaximumLength(512)`) only bites on a
         * value that arrived some other way — a legacy row, or a hand-edited
         * one. Validating it anyway keeps the save button honest: the server
         * would reject it, and the field can say why.
         */
        businessLicenseUrl: this._fb.control<string | null>(null, [
            absoluteHttpUrlValidator,
            trimmedMaxLengthValidator(URL_MAX_LENGTH),
        ]),
    });

    /**
     * The restaurant's previously-declared receiving hours, if any — not shown
     * in this form, only round-tripped unchanged on save (see the class doc).
     */
    private _pickupStart: string | null = null;
    private _pickupEnd: string | null = null;

    async ngOnInit(): Promise<void> {
        await this.reload();
    }

    /** (Re)loads the saved profile; also the retry action on the error state. */
    async reload(): Promise<void> {
        this.loading.set(true);
        this.loadError.set(null);
        try {
            const profile = await this._service.loadProfile();
            if (profile) {
                this.form.patchValue({
                    name: profile.name ?? '',
                    address: profile.address ?? null,
                    contactPerson: profile.contactPerson ?? null,
                    businessLicenseUrl: profile.businessLicenseUrl ?? null,
                });
                this._pickupStart = profile.pickupStart ?? null;
                this._pickupEnd = profile.pickupEnd ?? null;
            }
        } catch (err) {
            // 403 (not yet approved), 404, 5xx and offline each get their own
            // wording — the section explains *why* it is empty, and retries.
            this.loadError.set(
                await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'restaurantProfile.profile.loadError'
                )
            );
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Uploads the licence scan to Cloudinary and drops the hosted URL into the
     * form. Unlike the avatar this is *not* persisted immediately — it is one
     * field of a form the user is still editing, so it saves with the rest.
     */
    async onLicensePicked(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file || this.uploading()) {
            return;
        }
        if (!isImageFile(file)) {
            this.formError.set(
                this._transloco.translate(
                    'restaurantProfile.profile.notAnImage'
                )
            );
            return;
        }
        this.formError.set(null);
        this.uploading.set(true);
        try {
            const url = await uploadSignedImage(file, () =>
                restaurantProfileApi.apiV1RestaurantsMeBusinessLicenseUploadSignaturePostRaw()
            );
            if (!isUploadedImageUrl(url)) {
                this.formError.set(
                    this._transloco.translate(
                        'restaurantProfile.profile.licenseUrlRejected'
                    )
                );
                return;
            }
            this.form.controls.businessLicenseUrl.setValue(url);
            this.form.controls.businessLicenseUrl.markAsDirty();
        } catch (err) {
            this.formError.set(
                await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'admin.crud.image.uploadError'
                )
            );
        } finally {
            this.uploading.set(false);
        }
    }

    clearLicense(): void {
        this.form.controls.businessLicenseUrl.setValue(null);
        this.form.controls.businessLicenseUrl.markAsDirty();
    }

    /**
     * Persist the profile. Resolves `true` when the write succeeded.
     *
     * The boolean exists for the onboarding wizard, which may only advance a
     * step whose save actually landed (FR-024). Callers that just want the form
     * saved — the profile area's own button — can keep ignoring it.
     */
    async save(): Promise<boolean> {
        clearServerErrors(this.form);
        this.formError.set(null);
        if (this.form.invalid || this.uploading()) {
            this.form.markAllAsTouched();
            return false;
        }
        const v = this.form.getRawValue();
        const payload: UpdateRestaurantProfileRequest = {
            name: v.name.trim(),
            address: emptyToNull(v.address),
            contactPerson: emptyToNull(v.contactPerson),
            // Round-tripped unchanged — see the class doc for why this form
            // no longer lets the restaurant edit these.
            pickupStart: this._pickupStart,
            pickupEnd: this._pickupEnd,
            businessLicenseUrl: emptyToNull(v.businessLicenseUrl),
        };

        this.saving.set(true);
        try {
            await this._service.saveProfile(payload);
            this._toast('restaurantProfile.profile.saved');
            return true;
        } catch (err) {
            // Per-field rejections land on their control; everything else
            // (permission, conflict, server, offline) becomes a form message.
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
                          'restaurantProfile.profile.saveError'
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
