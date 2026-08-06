import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import {
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    latitudeValidator,
    longitudeValidator,
    nonBlankValidator,
    trimmedMaxLengthValidator,
} from 'app/core/api/validators';
import { LocationPickerComponent } from 'app/core/maps/location-picker.component';
import { CrudOption } from '../shared/resource-crud.types';
import {
    CatalogAdminService,
    MARKET_ADDRESS_MAX_LENGTH,
    MARKET_DESCRIPTION_MAX_LENGTH,
    MARKET_LOCATION_MAX_LENGTH,
    MARKET_NAME_MAX_LENGTH,
} from './catalog-admin.service';

/** Admin ▸ Catalog ▸ Markets ▸ New — full-page create form. */
@Component({
    selector: 'admin-market-create',
    templateUrl: './market-create.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSnackBarModule,
        MatSelectModule,
        MatTabsModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
        LocationPickerComponent,
    ],
    styles: [
        `
            .market-create-tabs .mdc-tab {
                min-width: 0;
                height: 38px;
                padding: 0 0.75rem;
            }

            .market-create-tabs .mdc-tab__text-label {
                font-size: 1rem;
                font-weight: 600;
            }

            .market-create-tabs .mdc-tab-indicator {
                bottom: -1px;
            }

            .market-create-tabs .mdc-tab-indicator__content--underline {
                border-top-width: 3px;
                transform: translateY(-2px);
            }
        `,
    ],
})
export class MarketCreateComponent implements OnInit {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    readonly saving = signal(false);
    readonly loadingProducts = signal(false);
    readonly selectedTab = signal(0);
    readonly productOptions = signal<CrudOption[]>([]);
    readonly selectedProductId = signal('');
    readonly pricingRows = signal<
        Array<{
            productId: string;
            name: string;
            price: number | null;
            quantity: number | null;
        }>
    >([]);

    readonly availableProductOptions = computed(() => {
        const selected = new Set(
            this.pricingRows().map((row) => row.productId)
        );
        return this.productOptions().filter((opt) => !selected.has(opt.value));
    });

    // Mirrors `CreateMarketCommandValidator`: name ≤ 200, location ≤ 200,
    // address ≤ 500, description ≤ 2000, and coordinates inside their real
    // ranges. Only the name was bounded here, so the other four could only be
    // rejected by the server, after the save.
    readonly createForm = new FormGroup({
        name: new FormControl('', {
            nonNullable: true,
            validators: [
                Validators.required,
                nonBlankValidator,
                trimmedMaxLengthValidator(MARKET_NAME_MAX_LENGTH),
            ],
        }),
        location: new FormControl('', {
            nonNullable: true,
            validators: [trimmedMaxLengthValidator(MARKET_LOCATION_MAX_LENGTH)],
        }),
        description: new FormControl('', {
            nonNullable: true,
            validators: [
                trimmedMaxLengthValidator(MARKET_DESCRIPTION_MAX_LENGTH),
            ],
        }),
        imageUrl: new FormControl('', { nonNullable: true }),
        address: new FormControl('', {
            nonNullable: true,
            validators: [trimmedMaxLengthValidator(MARKET_ADDRESS_MAX_LENGTH)],
        }),
        latitude: new FormControl<number | null>(null, [latitudeValidator]),
        longitude: new FormControl<number | null>(null, [longitudeValidator]),
    });

    readonly uploading = signal(false);

    /** Uploads the picked file and stores the hosted URL in `imageUrl`. */
    onImagePicked(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file || this.uploading()) {
            return;
        }
        this.uploading.set(true);
        void this._catalog
            .uploadMarketImage(file)
            .then((url) => this.createForm.controls.imageUrl.setValue(url))
            .catch(
                (err) =>
                    void this._notifyError(err, 'admin.crud.image.uploadError')
            )
            .finally(() => this.uploading.set(false));
    }

    clearImage(): void {
        this.createForm.controls.imageUrl.setValue('');
    }

    ngOnInit(): void {
        this.loadingProducts.set(true);
        this._catalog
            .productOptions()
            .then((options) => this.productOptions.set(options))
            .catch(() => this.productOptions.set([]))
            .finally(() => this.loadingProducts.set(false));
    }

    goBack(): void {
        void this._router.navigate(['/admin/markets']);
    }

    onTabChange(index: number): void {
        this.selectedTab.set(index);
    }

    addSelectedProduct(): void {
        const productId = this.selectedProductId();
        if (!productId) {
            return;
        }
        const opt = this.productOptions().find((p) => p.value === productId);
        if (!opt) {
            return;
        }
        this.pricingRows.update((rows) => [
            ...rows,
            { productId, name: opt.label, price: null, quantity: null },
        ]);
        this.selectedProductId.set('');
    }

    removePricingRow(productId: string): void {
        this.pricingRows.update((rows) =>
            rows.filter((row) => row.productId !== productId)
        );
    }

    updatePricingField(
        productId: string,
        field: 'price' | 'quantity',
        rawValue: string
    ): void {
        const value =
            rawValue === '' || Number.isNaN(Number(rawValue))
                ? null
                : Number(rawValue);
        this.pricingRows.update((rows) =>
            rows.map((row) =>
                row.productId === productId ? { ...row, [field]: value } : row
            )
        );
    }

    save(): void {
        if (this.createForm.invalid || this.uploading()) {
            this.createForm.markAllAsTouched();
            this.selectedTab.set(0);
            return;
        }
        this.saving.set(true);
        this._catalog
            .createMarket(this.createForm.getRawValue())
            .then(async (row) => {
                if (row?.id && this.pricingRows().length) {
                    await Promise.all(
                        this.pricingRows().map((item) =>
                            this._catalog.addMarketProduct(
                                row.id,
                                item.productId,
                                item.price,
                                item.quantity
                            )
                        )
                    );
                }
                this._notify('admin.crud.createSuccess');
                if (row?.id) {
                    void this._router.navigate(['/admin/markets', row.id], {
                        queryParams: { tab: 'pricing' },
                        state: { market: row },
                    });
                    return;
                }
                this.goBack();
            })
            .catch((err) => void this._notifyError(err, 'admin.crud.saveError'))
            .finally(() => this.saving.set(false));
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    private async _notifyError(
        err: unknown,
        fallbackKey: string
    ): Promise<void> {
        const message = await describeApiError(
            err,
            (key) => this._transloco.translate(key),
            fallbackKey
        );
        this._snackBar.open(message, undefined, { duration: 5000 });
    }
}
