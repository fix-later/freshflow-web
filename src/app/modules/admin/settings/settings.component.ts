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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { AdminService } from '../admin.service';
import { AdminOperationalSettings, AdminPricingSettings } from '../admin.types';

/**
 * Route types the backend accepts for `defaultRouteType`. The spec types the
 * field as a free-form nullable string with no enum, so this list mirrors the
 * route strategies in `specs/product/BUSINESS_RULES.md` rather than inventing
 * values — an unknown value loaded from the server is kept and shown as-is.
 */
const ROUTE_TYPES = ['direct', 'hub_and_spoke', 'milk_run'] as const;

/**
 * Admin ▸ Settings — platform-wide operational and pricing configuration
 * (`/admin/operational-settings`, `/admin/pricing-settings`). Both endpoints
 * are untyped in the spec, so values are read defensively and each card saves
 * independently so one failing PUT doesn't block the other.
 */
@Component({
    selector: 'admin-settings',
    templateUrl: './settings.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    // Full-width flex host so the page fills the screen (see ResourceCrudComponent).
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class AdminSettingsComponent implements OnInit {
    private readonly _admin = inject(AdminService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);

    readonly loading = signal(false);
    readonly savingOperational = signal(false);
    readonly savingPricing = signal(false);
    /** Route-type options, widened if the server returns an unlisted value. */
    readonly routeTypes = signal<string[]>([...ROUTE_TYPES]);

    readonly operationalForm = this._formBuilder.nonNullable.group({
        dailyCutoffTime: ['', Validators.required],
        batchingEnabled: [false],
        defaultRouteType: [''],
    });

    readonly pricingForm = this._formBuilder.nonNullable.group({
        priceAlertThresholdPercent: [
            10,
            [Validators.required, Validators.min(0.01), Validators.max(100)],
        ],
    });

    ngOnInit(): void {
        this._load();
    }

    private _load(): void {
        this.loading.set(true);
        Promise.all([
            this._admin
                .getOperationalSettings()
                .catch((): AdminOperationalSettings => ({})),
            this._admin
                .getPricingSettings()
                .catch((): AdminPricingSettings => ({})),
        ])
            .then(([operational, pricing]) => {
                const routeType = operational.defaultRouteType ?? '';
                if (routeType && !this.routeTypes().includes(routeType)) {
                    this.routeTypes.update((types) => [...types, routeType]);
                }
                this.operationalForm.patchValue({
                    // The API may send `HH:mm:ss`; `<input type="time">` wants `HH:mm`.
                    dailyCutoffTime: (operational.dailyCutoffTime ?? '').slice(
                        0,
                        5
                    ),
                    batchingEnabled: operational.batchingEnabled ?? false,
                    defaultRouteType: routeType,
                });
                this.pricingForm.patchValue({
                    priceAlertThresholdPercent:
                        pricing.priceAlertThresholdPercent ?? 10,
                });
            })
            .finally(() => this.loading.set(false));
    }

    saveOperational(): void {
        if (this.operationalForm.invalid) {
            this.operationalForm.markAllAsTouched();
            return;
        }
        const { dailyCutoffTime, batchingEnabled, defaultRouteType } =
            this.operationalForm.getRawValue();
        this.savingOperational.set(true);
        this._admin
            .updateOperationalSettings({
                dailyCutoffTime,
                batchingEnabled,
                defaultRouteType: defaultRouteType || null,
            })
            .then(() => {
                this._notifyKey('admin.settings.operational.success');
                // Re-read: the server normalises some values (a cut-off sent as
                // `HH:mm` comes back `HH:mm:ss`), so show what was stored.
                this._load();
            })
            .catch((err) => this._notifyError(err))
            .finally(() => this.savingOperational.set(false));
    }

    savePricing(): void {
        if (this.pricingForm.invalid) {
            this.pricingForm.markAllAsTouched();
            return;
        }
        this.savingPricing.set(true);
        this._admin
            .updatePricingSettings(this.pricingForm.getRawValue())
            .then(() => {
                this._notifyKey('admin.settings.pricing.success');
                this._load();
            })
            .catch((err) => this._notifyError(err))
            .finally(() => this.savingPricing.set(false));
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
