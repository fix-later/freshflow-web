import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
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
import { apiErrorMessage } from 'app/core/api/envelope';
import { ApprovalBannerComponent } from 'app/core/auth/components/approval-banner.component';
import { UpdateRestaurantProfileRequest } from 'contract';
import { RestaurantProfileService } from '../restaurant-profile.service';
import { pickupWindowValidator } from './pickup-window.validator';

/**
 * Restaurant business-profile editor (spec US1): name, address, contact person,
 * and receiving/pickup window, with the cross-field window validation and an
 * inline approval-status notice for accounts that are not yet approved.
 */
@Component({
    selector: 'business-profile-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './business-profile-form.component.html',
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
    readonly saving = signal(false);
    readonly loadError = signal(false);

    readonly form = this._fb.group(
        {
            name: this._fb.control('', {
                validators: [Validators.required],
                nonNullable: true,
            }),
            address: this._fb.control<string | null>(null),
            contactPerson: this._fb.control<string | null>(null),
            pickupStart: this._fb.control<string | null>(null),
            pickupEnd: this._fb.control<string | null>(null),
            businessLicenseUrl: this._fb.control<string | null>(null),
        },
        { validators: pickupWindowValidator() }
    );

    async ngOnInit(): Promise<void> {
        this.loading.set(true);
        this.loadError.set(false);
        try {
            const profile = await this._service.loadProfile();
            if (profile) {
                this.form.patchValue({
                    name: profile.name ?? '',
                    address: profile.address ?? null,
                    contactPerson: profile.contactPerson ?? null,
                    pickupStart: toInputTime(profile.pickupStart),
                    pickupEnd: toInputTime(profile.pickupEnd),
                    businessLicenseUrl: profile.businessLicenseUrl ?? null,
                });
            }
        } catch {
            this.loadError.set(true);
        } finally {
            this.loading.set(false);
        }
    }

    async save(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const v = this.form.getRawValue();
        const payload: UpdateRestaurantProfileRequest = {
            name: v.name.trim(),
            address: emptyToNull(v.address),
            contactPerson: emptyToNull(v.contactPerson),
            pickupStart: toApiTime(v.pickupStart),
            pickupEnd: toApiTime(v.pickupEnd),
            businessLicenseUrl: emptyToNull(v.businessLicenseUrl),
        };

        this.saving.set(true);
        try {
            await this._service.saveProfile(payload);
            this._toast('restaurantProfile.profile.saved');
        } catch (err) {
            // Show the backend's rejection reason (permission, validation…) when
            // it sent one, else a translated generic message.
            const message =
                (await apiErrorMessage(err)) ??
                this._transloco.translate(
                    'restaurantProfile.profile.saveError'
                );
            this._snackBar.open(message, undefined, { duration: 6000 });
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

/** `HH:mm:ss` (or null) → `HH:mm` for the native time input. */
function toInputTime(value: string | null | undefined): string | null {
    if (!value) {
        return null;
    }
    return value.slice(0, 5);
}

/** `HH:mm` from the time input → `HH:mm:ss` for the API; empty → null. */
function toApiTime(value: string | null): string | null {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
        return null;
    }
    return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
}

/** Blank strings become null so unset fields are cleared, not stored empty. */
function emptyToNull(value: string | null): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed === '' ? null : trimmed;
}
