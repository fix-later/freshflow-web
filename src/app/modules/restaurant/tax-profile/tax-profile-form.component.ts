import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { apiErrorMessage } from 'app/core/api/envelope';
import { UpdateTaxProfileRequest } from 'contract';
import { RestaurantProfileService } from '../restaurant-profile.service';

/**
 * Restaurant tax-profile editor: tax code, legal (invoicing) name, billing
 * address, and billing email — used to generate correct VAT invoices.
 * `PUT /restaurants/me/tax-profile` is write-only (the spec has no matching
 * GET), so the form always starts blank rather than pre-filling saved values.
 */
@Component({
    selector: 'tax-profile-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './tax-profile-form.component.html',
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
export class TaxProfileFormComponent {
    private readonly _fb = inject(FormBuilder);
    private readonly _service = inject(RestaurantProfileService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    readonly saving = signal(false);

    readonly form = this._fb.group({
        taxCode: this._fb.control<string | null>(null),
        legalName: this._fb.control<string | null>(null),
        address: this._fb.control<string | null>(null),
        email: this._fb.control<string | null>(null, [Validators.email]),
    });

    async save(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
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
        } catch (err) {
            const message =
                (await apiErrorMessage(err)) ??
                this._transloco.translate(
                    'restaurantProfile.taxProfile.saveError'
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
