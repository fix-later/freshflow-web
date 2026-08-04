import { NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    input,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { includesFolded } from 'app/core/util/text-search';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { CrudRow } from '../shared/resource-crud.types';
import { TableSort } from '../shared/table-sort';
import { CatalogAdminService } from './catalog-admin.service';

interface MarketProductRow {
    productId: string;
    name: string;
    price: number | null;
    quantity: number | null;
}

interface ProductSelectionRow {
    id: string;
    name: string;
    category: string;
    unit: string;
    description: string;
}

function num(value: unknown): number | null {
    if (value == null || value === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * `PricingOptions.MaxPriceVnd` — the ceiling
 * `CreateMarketProductCommandValidator` enforces (400 above it).
 */
const MAX_PRICE_VND = 50_000_000;

/** Decimal places in `value`, for the "at most 2" price rule. */
function decimalPlaces(value: number): number {
    const text = String(value);
    const dot = text.indexOf('.');
    return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * Admin ▸ Catalog ▸ Markets ▸ Pricing — inventory list + inline quick multi-add.
 */
@Component({
    selector: 'admin-market-products',
    templateUrl: './market-products.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        FormsModule,
        NgTemplateOutlet,
        AdminLoadingStateComponent,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSnackBarModule,
        MatTooltipModule,
        TranslocoModule,
    ],
    styles: [
        `
            .market-products-grid {
                grid-template-columns: minmax(0, 1.4fr) 9rem 9rem 5rem;
            }

            .product-picker-grid {
                grid-template-columns:
                    2.5rem minmax(0, 1.8fr) minmax(0, 1fr) minmax(0, 0.7fr)
                    9rem 9rem;
            }
        `,
    ],
})
export class MarketProductsComponent implements OnInit {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    /** When true, renders only the pricing toolbar + grid (for market edit tabs). */
    readonly embedded = input(false);
    readonly marketId = input('');

    readonly effectiveMarketId = computed(
        () => this.marketId() || this._routeMarketId
    );

    private readonly _routeMarketId =
        this._route.snapshot.paramMap.get('marketId') ?? '';

    readonly marketName = signal('');
    readonly rows = signal<MarketProductRow[]>([]);
    readonly sort = new TableSort<MarketProductRow>();
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly loadingProducts = signal(false);
    readonly search = signal('');

    readonly pickerOpen = signal(false);
    readonly pickerSearch = signal('');
    readonly pickerSelectedIds = signal<Set<string>>(new Set());
    readonly pickerProducts = signal<ProductSelectionRow[]>([]);

    readonly selectableProducts = computed(() => {
        const taken = new Set(this.rows().map((row) => row.productId));
        return this.pickerProducts().filter((p) => !taken.has(p.id));
    });

    readonly filteredPickerProducts = computed(() => {
        const term = this.pickerSearch().trim();
        const rows = this.selectableProducts();
        if (!term) {
            return rows;
        }
        return rows.filter((row) =>
            [row.name, row.category, row.unit, row.description].some((field) =>
                includesFolded(field, term)
            )
        );
    });

    readonly pickerSelectedCount = computed(
        () => this.pickerSelectedIds().size
    );

    readonly allVisibleSelected = computed(() => {
        const visible = this.filteredPickerProducts();
        if (!visible.length) {
            return false;
        }
        const selected = this.pickerSelectedIds();
        return visible.every((row) => selected.has(row.id));
    });

    readonly filteredRows = computed(() => {
        const term = this.search().trim();
        const list = this.rows();
        if (!term) {
            return list;
        }
        return list.filter((row) => includesFolded(row.name, term));
    });

    readonly sortedRows = computed(() =>
        this.sort.apply(
            this.filteredRows(),
            (row, key) => row[key as keyof MarketProductRow]
        )
    );

    /** Per-row draft edits, keyed by product id. */
    priceDraft: Record<string, number | null> = {};
    quantityDraft: Record<string, number | null> = {};

    /**
     * Initial price / quantity typed in the quick-add picker, keyed by product id.
     *
     * Listing a product **requires** a price: `CreateMarketProductRequest` is a
     * positional record with a non-nullable `decimal InitialPrice`, so omitting
     * it binds to `0` and the handler answers 422 `INVALID_PRICE`. The picker
     * used to send nothing at all, which is why every quick-add failed with a
     * bare "could not save".
     */
    pickerPrice: Record<string, number | null> = {};
    pickerQuantity: Record<string, number | null> = {};

    readonly maxPrice = MAX_PRICE_VND;

    /** Localized reason the last quick-add was rejected, kept next to the form. */
    readonly quickAddError = signal<string | null>(null);

    ngOnInit(): void {
        const id = this.effectiveMarketId();
        if (!this.embedded()) {
            const passed = (history.state?.market ?? null) as CrudRow | null;
            if (passed && passed.id === id) {
                this.marketName.set(String(passed['name'] ?? ''));
            } else if (id) {
                void this._catalog
                    .getMarket(id)
                    .then((row) =>
                        this.marketName.set(String(row?.['name'] ?? ''))
                    )
                    .catch(() => this.marketName.set(''));
            }
        }

        this.load();
        this._loadPickerProducts();
    }

    goBack(): void {
        if (this.embedded()) {
            return;
        }
        void this._router.navigate(['/admin/markets']);
    }

    onSearch(value: string): void {
        this.search.set(value);
    }

    openQuickAdd(): void {
        this.pickerSearch.set('');
        this.pickerSelectedIds.set(new Set());
        this.pickerPrice = {};
        this.pickerQuantity = {};
        this.quickAddError.set(null);
        this.pickerOpen.set(true);
    }

    closeQuickAdd(): void {
        this.pickerOpen.set(false);
        this.pickerSearch.set('');
        this.pickerSelectedIds.set(new Set());
        this.pickerPrice = {};
        this.pickerQuantity = {};
        this.quickAddError.set(null);
    }

    /**
     * The client-side verdict on one picker row's price, as an i18n key.
     * Mirrors the handler (`> 0`) and the validator (`<= MaxPriceVnd`, at most
     * two decimals), so a rejected listing never reaches the server.
     *
     * A method rather than a `computed()`: it reads a plain object bound with
     * `ngModel`, which is not a signal.
     */
    priceErrorKey(productId: string): string | null {
        if (!this.isPickerSelected(productId)) {
            return null;
        }
        const price = num(this.pickerPrice[productId]);
        if (price === null) {
            return 'admin.markets.pricing.priceRequired';
        }
        if (price <= 0) {
            return 'admin.markets.pricing.pricePositive';
        }
        if (price > MAX_PRICE_VND) {
            return 'admin.markets.pricing.priceTooHigh';
        }
        if (decimalPlaces(price) > 2) {
            return 'admin.markets.pricing.priceDecimals';
        }
        return null;
    }

    /** `InitialQuantity` must be a non-negative integer (422 INVALID_QUANTITY). */
    quantityErrorKey(productId: string): string | null {
        if (!this.isPickerSelected(productId)) {
            return null;
        }
        const quantity = num(this.pickerQuantity[productId]);
        if (quantity === null) {
            return null; // optional — omitted means 0
        }
        if (quantity < 0) {
            return 'admin.markets.pricing.quantityNonNegative';
        }
        return Number.isInteger(quantity)
            ? null
            : 'admin.markets.pricing.quantityInteger';
    }

    /** Every selected row must carry a valid price before the batch is sent. */
    canSaveQuickAdd(): boolean {
        const ids = [...this.pickerSelectedIds()];
        if (!ids.length || this.saving()) {
            return false;
        }
        return ids.every(
            (id) =>
                this.priceErrorKey(id) === null &&
                this.quantityErrorKey(id) === null
        );
    }

    onPickerSearch(value: string): void {
        this.pickerSearch.set(value);
    }

    isPickerSelected(productId: string): boolean {
        return this.pickerSelectedIds().has(productId);
    }

    togglePickerSelect(productId: string): void {
        this.pickerSelectedIds.update((current) => {
            const next = new Set(current);
            if (next.has(productId)) {
                next.delete(productId);
            } else {
                next.add(productId);
            }
            return next;
        });
    }

    toggleSelectAllVisible(checked: boolean): void {
        this.pickerSelectedIds.update((current) => {
            const next = new Set(current);
            for (const row of this.filteredPickerProducts()) {
                if (checked) {
                    next.add(row.id);
                } else {
                    next.delete(row.id);
                }
            }
            return next;
        });
    }

    saveQuickAdd(): void {
        const ids = [...this.pickerSelectedIds()];
        if (!this.canSaveQuickAdd()) {
            return;
        }
        this.quickAddError.set(null);
        this.saving.set(true);
        // `allSettled`, not `all`: listing several products is N independent
        // calls, and a fail-fast reject would leave the user with a generic
        // error and no idea which ones actually landed.
        void Promise.allSettled(
            ids.map((productId) =>
                this._catalog.addMarketProduct(
                    this.effectiveMarketId(),
                    productId,
                    num(this.pickerPrice[productId]),
                    num(this.pickerQuantity[productId]) ?? 0
                )
            )
        )
            .then(async (results) => {
                const failures = results.filter(
                    (r): r is PromiseRejectedResult => r.status === 'rejected'
                );
                if (!failures.length) {
                    this._notify('admin.crud.createSuccess');
                    this.closeQuickAdd();
                    this.load();
                    return;
                }
                // Report the server's own reason for the first failure, and say
                // how many of the batch it applies to.
                const reason = await describeApiError(
                    failures[0].reason,
                    (key) => this._transloco.translate(key),
                    'admin.crud.saveError'
                );
                this.quickAddError.set(
                    this._transloco.translate(
                        'admin.markets.pricing.quickAddPartial',
                        { failed: failures.length, total: results.length }
                    ) + ` ${reason}`
                );
                // Keep the picker open so the rows that failed can be retried,
                // but refresh so the ones that succeeded drop out of the list.
                this.load();
            })
            .finally(() => this.saving.set(false));
    }

    load(): void {
        const marketId = this.effectiveMarketId();
        if (!marketId) {
            return;
        }
        this.loading.set(true);
        this._catalog
            .listMarketProducts(marketId)
            .then((rows) => {
                const mapped = rows.map((row) => this._normalize(row));
                this.rows.set(mapped);
                for (const row of mapped) {
                    this.priceDraft[row.productId] = row.price;
                    this.quantityDraft[row.productId] = row.quantity;
                }
            })
            .catch(() => {
                this.rows.set([]);
                this._notify('admin.crud.loadError');
            })
            .finally(() => this.loading.set(false));
    }

    saveRow(row: MarketProductRow): void {
        const price = num(this.priceDraft[row.productId]);
        const quantity = num(this.quantityDraft[row.productId]);
        const tasks: Promise<void>[] = [];
        if (price != null && price !== row.price) {
            tasks.push(
                this._catalog.updateMarketPrice(
                    this.effectiveMarketId(),
                    row.productId,
                    price
                )
            );
        }
        if (quantity != null && quantity !== row.quantity) {
            tasks.push(
                this._catalog.updateMarketQuantity(
                    this.effectiveMarketId(),
                    row.productId,
                    quantity
                )
            );
        }
        if (!tasks.length) {
            return;
        }
        this.saving.set(true);
        Promise.all(tasks)
            .then(() => {
                this._notify('admin.crud.updateSuccess');
                this.load();
            })
            .catch(() => this._notify('admin.crud.saveError'))
            .finally(() => this.saving.set(false));
    }

    private _loadPickerProducts(): void {
        this.loadingProducts.set(true);
        void this._catalog
            .listAllProductsForSelection()
            .then((rows) =>
                this.pickerProducts.set(
                    rows.map((row) => ({
                        id: row.id,
                        name: String(row['name'] ?? ''),
                        category: String(row['categoryName'] ?? ''),
                        unit: String(
                            row['unitName'] ?? row['unitAbbreviation'] ?? ''
                        ),
                        description: String(row['description'] ?? ''),
                    }))
                )
            )
            .catch(() => this.pickerProducts.set([]))
            .finally(() => this.loadingProducts.set(false));
    }

    private _normalize(row: CrudRow): MarketProductRow {
        return {
            productId: String(row['productId'] ?? row.id ?? ''),
            name: String(row['productName'] ?? row['name'] ?? ''),
            price: num(row['price'] ?? row['currentPrice']),
            quantity: num(row['availableQuantity'] ?? row['quantity']),
        };
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }
}
