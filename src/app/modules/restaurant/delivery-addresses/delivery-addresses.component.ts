import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
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
    ADDRESS_LINE_MAX_LENGTH,
    latitudeValidator,
    longitudeValidator,
    NAME_MAX_LENGTH,
    nonBlankValidator,
    phoneNumberValidator,
    trimmedMaxLengthValidator,
} from 'app/core/api/validators';
import { LocationPickerComponent } from 'app/core/maps/location-picker.component';
import { DeliveryAddressRequest } from 'contract';
import { RestaurantProfileService } from '../restaurant-profile.service';
import { DeliveryAddressView } from '../restaurant-profile.types';

/**
 * Restaurant's saved delivery addresses: list + add/edit form
 * (`GET/POST/PUT/DELETE /restaurants/me/delivery-addresses`).
 */
@Component({
    selector: 'delivery-addresses',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './delivery-addresses.component.html',
    styleUrl: './delivery-addresses.component.scss',
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatCheckboxModule,
        MatProgressBarModule,
        MatSnackBarModule,
        MatTooltipModule,
        TranslocoModule,
        LocationPickerComponent,
    ],
})
export class DeliveryAddressesComponent implements OnInit {
    private readonly _fb = inject(FormBuilder);
    private readonly _service = inject(RestaurantProfileService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    readonly addresses = this._service.deliveryAddresses;

    readonly loading = signal(false);
    readonly saving = signal(false);
    /** Localized reason the list read failed — drives the retry state. */
    readonly loadError = signal<string | null>(null);
    /** Localized reason a write failed when it wasn't a per-field rejection. */
    readonly formError = signal<string | null>(null);
    /** Id of the address a delete is in flight for, so only its row spins. */
    readonly removingId = signal<string | null>(null);

    /** Template helpers for per-field messages. */
    readonly errorKey = fieldErrorKey;
    readonly maxLength = fieldMaxLength;
    readonly serverMessage = serverError;
    readonly formOpen = signal(false);
    /** `null` while adding; the address id while editing an existing one. */
    readonly editingId = signal<string | null>(null);

    readonly form = this._fb.group({
        // `addressLine` is `minLength 1, maxLength 500` on
        // DeliveryAddressRequest; the rest are nullable, bound by the
        // documented §6 rules (name ≤255, phone 7–15 digits, real coordinates).
        addressLine: this._fb.control('', {
            validators: [
                Validators.required,
                nonBlankValidator,
                trimmedMaxLengthValidator(ADDRESS_LINE_MAX_LENGTH),
            ],
            nonNullable: true,
        }),
        recipientName: this._fb.control<string | null>(null, [
            trimmedMaxLengthValidator(NAME_MAX_LENGTH),
        ]),
        phone: this._fb.control<string | null>(null, [phoneNumberValidator]),
        latitude: this._fb.control<number | null>(null, [latitudeValidator]),
        longitude: this._fb.control<number | null>(null, [longitudeValidator]),
        isDefault: this._fb.control(false, { nonNullable: true }),
    });

    async ngOnInit(): Promise<void> {
        await this.reload();
    }

    /** (Re)loads the saved addresses; also the retry action on the error state. */
    async reload(): Promise<void> {
        this.loading.set(true);
        this.loadError.set(null);
        try {
            await this._service.loadDeliveryAddresses();
        } catch (err) {
            // A failed read is not an empty address book — say which it is.
            this.loadError.set(
                await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'restaurantProfile.deliveryAddresses.loadError'
                )
            );
        } finally {
            this.loading.set(false);
        }
    }

    openAdd(): void {
        this.editingId.set(null);
        this.formError.set(null);
        this.form.reset({
            addressLine: '',
            recipientName: null,
            phone: null,
            latitude: null,
            longitude: null,
            isDefault: this.addresses().length === 0,
        });
        this.formOpen.set(true);
    }

    openEdit(address: DeliveryAddressView): void {
        this.editingId.set(address.id);
        this.formError.set(null);
        this.form.reset({
            addressLine: address.addressLine,
            recipientName: address.recipientName ?? null,
            phone: address.phone ?? null,
            latitude: address.latitude ?? null,
            longitude: address.longitude ?? null,
            isDefault: address.isDefault ?? false,
        });
        this.formOpen.set(true);
    }

    closeForm(): void {
        this.formOpen.set(false);
    }

    /** Persist the open address form. Resolves `true` when the write succeeded. */
    async save(): Promise<boolean> {
        clearServerErrors(this.form);
        this.formError.set(null);
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return false;
        }
        const v = this.form.getRawValue();
        const payload: DeliveryAddressRequest = {
            addressLine: v.addressLine.trim(),
            recipientName: emptyToNull(v.recipientName),
            phone: emptyToNull(v.phone),
            latitude: v.latitude,
            longitude: v.longitude,
            isDefault: v.isDefault,
        };

        this.saving.set(true);
        try {
            const id = this.editingId();
            if (id) {
                await this._service.updateDeliveryAddress(id, payload);
            } else {
                await this._service.addDeliveryAddress(payload);
            }
            this._toast('restaurantProfile.deliveryAddresses.saved');
            this.formOpen.set(false);
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
                          'restaurantProfile.deliveryAddresses.saveError'
                      )
            );
            return false;
        } finally {
            this.saving.set(false);
        }
    }

    async remove(address: DeliveryAddressView): Promise<void> {
        if (this.removingId()) {
            return;
        }
        this.formError.set(null);
        this.removingId.set(address.id);
        try {
            await this._service.removeDeliveryAddress(address.id);
            this._toast('restaurantProfile.deliveryAddresses.removed');
        } catch (err) {
            // A 404 here means someone else already deleted it — re-read so the
            // list stops showing a row the backend no longer has.
            this.formError.set(
                await describeApiError(
                    err,
                    (key) => this._transloco.translate(key),
                    'restaurantProfile.deliveryAddresses.removeError'
                )
            );
            await this.reload();
        } finally {
            this.removingId.set(null);
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
