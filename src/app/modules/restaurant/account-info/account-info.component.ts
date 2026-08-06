import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
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
    NAME_MAX_LENGTH,
    PHONE_MAX_LENGTH,
    phoneNumberValidator,
    trimmedMaxLengthValidator,
} from 'app/core/api/validators';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.types';
import { profileApi } from 'contract';
import { firstValueFrom } from 'rxjs';

/**
 * Personal account editor — `GET/PUT /api/v1/profile/me` plus the avatar's
 * `POST /api/v1/profile/me/avatar/upload-signature`. Every role has one.
 *
 * `UpdateMyProfileRequest` declares `fullName` / `phone` / `avatarUrl` as
 * nullable strings; the documented §6 rules (name ≤255, phone 7–15 digits with
 * an optional `+`, Cloudinary-hosted image URL ≤512) are mirrored client-side
 * so a rejection is shown at the field before any request is sent. Whatever
 * the server still rejects is pinned back onto the offending control.
 */
@Component({
    selector: 'account-info',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './account-info.component.html',
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
export class AccountInfoComponent implements OnInit {
    private readonly _fb = inject(FormBuilder);
    private readonly _userService = inject(UserService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    readonly saving = signal(false);
    readonly uploading = signal(false);
    readonly email = signal('');
    readonly avatarUrl = signal<string | null>(null);
    /** Form-level rejection (403, network, …) — the field-less failures. */
    readonly formError = signal<string | null>(null);

    /** Template helpers for per-field messages. */
    readonly errorKey = fieldErrorKey;
    readonly maxLength = fieldMaxLength;
    readonly serverMessage = serverError;

    readonly form = this._fb.group({
        fullName: this._fb.control('', {
            nonNullable: true,
            validators: [trimmedMaxLengthValidator(NAME_MAX_LENGTH)],
        }),
        phone: this._fb.control('', {
            nonNullable: true,
            // `UpdateMyProfileCommandValidator` pairs the format regex with
            // `MaximumLength(20)`; the regex alone tops out at 16 characters,
            // but the cap is what the server enforces, so it is what we mirror.
            validators: [
                phoneNumberValidator,
                trimmedMaxLengthValidator(PHONE_MAX_LENGTH),
            ],
        }),
    });

    ngOnInit(): void {
        const user = this._userService.current;
        if (user) {
            this._apply(user);
        }
    }

    async save(): Promise<void> {
        clearServerErrors(this.form);
        this.formError.set(null);
        const current = this._userService.current;
        if (!current || this.saving()) {
            return;
        }
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const v = this.form.getRawValue();
        this.saving.set(true);
        try {
            await firstValueFrom(
                this._userService.update({
                    ...current,
                    fullName: v.fullName.trim() || null,
                    phone: v.phone.trim() || null,
                })
            );
            this._toast('accountInfo.saved');
        } catch (err) {
            await this._reportSaveFailure(err, 'accountInfo.saveError');
        } finally {
            this.saving.set(false);
        }
    }

    /**
     * Uploads the picked file to Cloudinary and persists the hosted URL on the
     * profile straight away — an avatar the user can see but hasn't saved is a
     * trap, and `PUT /profile/me` is the same call `save()` makes anyway.
     */
    async onAvatarPicked(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file || this.uploading()) {
            return;
        }
        // Cloudinary's image endpoint rejects a non-image; say so immediately
        // instead of spending a round-trip on it.
        if (!isImageFile(file)) {
            this.formError.set(
                this._transloco.translate('accountInfo.avatarNotAnImage')
            );
            return;
        }
        this.formError.set(null);
        this.uploading.set(true);
        try {
            const url = await uploadSignedImage(file, () =>
                profileApi.apiV1ProfileMeAvatarUploadSignaturePostRaw()
            );
            if (!isUploadedImageUrl(url)) {
                // The host would reject this URL on save — don't store it.
                this.formError.set(
                    this._transloco.translate('accountInfo.avatarUrlRejected')
                );
                return;
            }
            await this._persistAvatar(url);
            this._toast('accountInfo.avatarSaved');
        } catch (err) {
            this.formError.set(
                await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'accountInfo.avatarError'
                )
            );
        } finally {
            this.uploading.set(false);
        }
    }

    async removeAvatar(): Promise<void> {
        if (this.uploading() || !this.avatarUrl()) {
            return;
        }
        this.formError.set(null);
        this.uploading.set(true);
        try {
            await this._persistAvatar(null);
            this._toast('accountInfo.avatarSaved');
        } catch (err) {
            this.formError.set(
                await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'accountInfo.avatarError'
                )
            );
        } finally {
            this.uploading.set(false);
        }
    }

    /**
     * Persists `avatarUrl` without clobbering unsaved edits in the form: the
     * name/phone the user is currently typing win over the stored profile.
     */
    private async _persistAvatar(url: string | null): Promise<void> {
        const current = this._userService.current;
        if (!current) {
            return;
        }
        const v = this.form.getRawValue();
        const updated = await firstValueFrom(
            this._userService.update({
                ...current,
                fullName: v.fullName.trim() || null,
                phone: v.phone.trim() || null,
                avatarUrl: url,
            })
        );
        this.avatarUrl.set(updated.avatarUrl ?? null);
    }

    /**
     * Field-level rejections land on their control; anything else (403 from a
     * disabled account, a 5xx, an offline browser) becomes a form-level
     * message, so no backend answer is ever swallowed.
     */
    private async _reportSaveFailure(
        err: unknown,
        fallbackKey: string
    ): Promise<void> {
        const translate = (key: string): string =>
            this._transloco.translate(key);
        const { handled } = await applyApiErrorToForm(
            this.form,
            err,
            translate
        );
        if (handled) {
            this.formError.set(
                this._transloco.translate('errors.api.validation')
            );
            return;
        }
        this.formError.set(await describeApiError(err, translate, fallbackKey));
    }

    private _apply(user: User): void {
        this.email.set(user.email);
        this.avatarUrl.set(user.avatarUrl ?? null);
        // `User.name` falls back to email for the header menu — never seed the
        // editable full-name field with that, or the form looks like a duplicate.
        const fullName =
            user.fullName && user.fullName !== user.email ? user.fullName : '';
        this.form.reset({
            fullName,
            phone: user.phone ?? '',
        });
    }

    private _toast(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }
}
