import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { DateTime } from 'luxon';
import { AdminService } from '../admin.service';
import { AdminOperationalSettings } from '../admin.types';

/**
 * The only values `UpdateOperationalSettingsCommandValidator` accepts:
 * "DefaultRouteType must be one of: hub_relay, direct."
 *
 * The list previously also offered `hub_and_spoke` and `milk_run` — taken from
 * `specs/product/BUSINESS_RULES.md` — but the backend has never accepted
 * either, so choosing one produced a guaranteed 400 on save. An unlisted value
 * already stored on the server is still shown (see `_load`) rather than being
 * silently rewritten.
 */
const ROUTE_TYPES = ['hub_relay', 'direct'] as const;

/** `DeliveryFeePerKm` / `RoundingUnit` — `InclusiveBetween(0, 1_000_000)`. */
const DELIVERY_FEE_PER_KM_MAX = 1_000_000;

/** `BaseFee` / `MinimumFee` — `InclusiveBetween(0, 10_000_000)`. */
const FEE_MAX = 10_000_000;

/** Parse API `HH:mm` / `HH:mm:ss` into a Luxon DateTime for the timepicker. */
function parseCutoffTime(raw: string | null | undefined): DateTime | null {
    const hhmm = (raw ?? '').trim().slice(0, 5);
    if (!hhmm) {
        return null;
    }
    const parsed = DateTime.fromFormat(hhmm, 'HH:mm');
    return parsed.isValid ? parsed : null;
}

/**
 * Admin settings dialog — operational + pricing in one form, one Save.
 * Opened from Order groups (and the dashboard shortcut).
 */
@Component({
    selector: 'admin-settings-dialog',
    templateUrl: './settings.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatCheckboxModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTimepickerModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class AdminSettingsDialogComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly _dialogRef = inject(
        MatDialogRef<AdminSettingsDialogComponent>
    );

    readonly loading = signal(false);
    readonly saving = signal(false);
    /** Route-type options, widened if the server returns an unlisted value. */
    readonly routeTypes = signal<string[]>([...ROUTE_TYPES]);

    readonly form = this._formBuilder.group({
        dailyCutoffTime: this._formBuilder.control<DateTime | null>(null, {
            validators: [Validators.required],
        }),
        batchingEnabled: this._formBuilder.nonNullable.control(false),
        defaultRouteType: this._formBuilder.nonNullable.control(''),
        deliveryWindowDays: this._formBuilder.nonNullable.control(7, [
            Validators.required,
            Validators.min(1),
            Validators.max(30),
        ]),
        deliveryFeePerKm: this._formBuilder.nonNullable.control(5000, [
            Validators.required,
            Validators.min(0),
            Validators.max(DELIVERY_FEE_PER_KM_MAX),
        ]),
        baseFee: this._formBuilder.nonNullable.control(0, [
            Validators.required,
            Validators.min(0),
            Validators.max(FEE_MAX),
        ]),
        minimumFee: this._formBuilder.nonNullable.control(0, [
            Validators.required,
            Validators.min(0),
            Validators.max(FEE_MAX),
        ]),
        roundingUnit: this._formBuilder.nonNullable.control(0, [
            Validators.required,
            Validators.min(0),
            Validators.max(DELIVERY_FEE_PER_KM_MAX),
        ]),
    });

    ngOnInit(): void {
        this._load();
    }

    close(): void {
        this._dialogRef.close();
    }

    private _load(): void {
        this.loading.set(true);
        this._admin
            .getOperationalSettings()
            .catch((): AdminOperationalSettings => ({}))
            .then((operational) => {
                const routeType = operational.defaultRouteType ?? '';
                if (routeType && !this.routeTypes().includes(routeType)) {
                    this.routeTypes.update((types) => [...types, routeType]);
                }
                this.form.patchValue({
                    dailyCutoffTime: parseCutoffTime(
                        operational.dailyCutoffTime
                    ),
                    batchingEnabled: operational.batchingEnabled ?? false,
                    defaultRouteType: routeType,
                    deliveryWindowDays: operational.deliveryWindowDays ?? 7,
                    deliveryFeePerKm: operational.deliveryFeePerKm ?? 5000,
                    baseFee: operational.baseFee ?? 0,
                    minimumFee: operational.minimumFee ?? 0,
                    roundingUnit: operational.roundingUnit ?? 0,
                });
            })
            .finally(() => this.loading.set(false));
    }

    save(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const {
            dailyCutoffTime,
            batchingEnabled,
            defaultRouteType,
            deliveryWindowDays,
            deliveryFeePerKm,
            baseFee,
            minimumFee,
            roundingUnit,
        } = this.form.getRawValue();
        if (!dailyCutoffTime?.isValid) {
            this.form.controls.dailyCutoffTime.setErrors({ required: true });
            return;
        }
        const time = dailyCutoffTime.toFormat('HH:mm');
        this.saving.set(true);
        this._admin
            .updateOperationalSettings({
                dailyCutoffTime: time,
                batchingEnabled: batchingEnabled ?? false,
                defaultRouteType: defaultRouteType || null,
                deliveryWindowDays: deliveryWindowDays ?? 7,
                deliveryFeePerKm: deliveryFeePerKm ?? 5000,
                baseFee: baseFee ?? 0,
                minimumFee: minimumFee ?? 0,
                roundingUnit: roundingUnit ?? 0,
            })
            .then(() => {
                this._notifyKey('admin.settings.saveSuccess');
                this._load();
            })
            .catch((err) => void this._notifyError(err))
            .finally(() => this.saving.set(false));
    }

    private _notifyKey(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    private async _notifyError(err: unknown): Promise<void> {
        const message = await describeApiError(
            err,
            (key) => this._transloco.translate(key),
            'admin.settings.error'
        );
        this._snackBar.open(message, undefined, { duration: 5000 });
    }
}
