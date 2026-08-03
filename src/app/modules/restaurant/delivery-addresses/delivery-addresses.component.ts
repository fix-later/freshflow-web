import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    inject,
    signal,
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
import { apiErrorMessage } from 'app/core/api/envelope';
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
    templateUrl: './delivery-addresses.component.html',
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
    readonly formOpen = signal(false);
    /** `null` while adding; the address id while editing an existing one. */
    readonly editingId = signal<string | null>(null);

    readonly form = this._fb.group({
        addressLine: this._fb.control('', {
            validators: [Validators.required],
            nonNullable: true,
        }),
        recipientName: this._fb.control<string | null>(null),
        phone: this._fb.control<string | null>(null),
        latitude: this._fb.control<number | null>(null),
        longitude: this._fb.control<number | null>(null),
        isDefault: this._fb.control(false, { nonNullable: true }),
    });

    async ngOnInit(): Promise<void> {
        this.loading.set(true);
        try {
            await this._service.loadDeliveryAddresses();
        } catch {
            // Empty list on failure — the section just shows the empty state.
        } finally {
            this.loading.set(false);
        }
    }

    openAdd(): void {
        this.editingId.set(null);
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
            const message =
                (await apiErrorMessage(err)) ??
                this._transloco.translate(
                    'restaurantProfile.deliveryAddresses.saveError'
                );
            this._snackBar.open(message, undefined, { duration: 6000 });
            return false;
        } finally {
            this.saving.set(false);
        }
    }

    async remove(address: DeliveryAddressView): Promise<void> {
        this.saving.set(true);
        try {
            await this._service.removeDeliveryAddress(address.id);
            this._toast('restaurantProfile.deliveryAddresses.removed');
        } catch (err) {
            const message =
                (await apiErrorMessage(err)) ??
                this._transloco.translate(
                    'restaurantProfile.deliveryAddresses.removeError'
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

/** Blank strings become null so unset fields are cleared, not stored empty. */
function emptyToNull(value: string | null): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed === '' ? null : trimmed;
}
