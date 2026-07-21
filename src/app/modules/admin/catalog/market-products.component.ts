import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { CrudOption, CrudRow } from '../shared/resource-crud.types';
import { TableSort } from '../shared/table-sort';
import { CatalogAdminService } from './catalog-admin.service';

interface MarketProductRow {
    productId: string;
    name: string;
    price: number | null;
    quantity: number | null;
}

function num(value: unknown): number | null {
    if (value == null || value === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
}

/** Admin ▸ Catalog ▸ Markets ▸ Pricing — per-market product price & quantity. */
@Component({
    selector: 'admin-market-products',
    templateUrl: './market-products.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    // Full-width flex host so the page fills the screen (see ResourceCrudComponent).
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class MarketProductsComponent implements OnInit {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);

    readonly marketId = this._route.snapshot.paramMap.get('marketId') ?? '';

    readonly rows = signal<MarketProductRow[]>([]);

    /**
     * Column sort. The price/quantity drafts are keyed by `productId`, not by
     * row index, so reordering the table never moves a pending edit onto the
     * wrong product.
     */
    readonly sort = new TableSort<MarketProductRow>();

    /** {@link rows} in the active sort order. */
    readonly sortedRows = computed(() =>
        this.sort.apply(
            this.rows(),
            (row, key) => row[key as keyof MarketProductRow]
        )
    );
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly productOptions = signal<CrudOption[]>([]);

    /**
     * Products that can still be added to this market — the full catalogue
     * minus the ones already priced here.
     *
     * Derived from {@link rows} rather than filtered once at load, so adding a
     * product removes it from the picker as soon as the table reloads. Offering
     * it again would just fail on the server as a duplicate.
     */
    readonly availableProductOptions = computed(() => {
        const taken = new Set(this.rows().map((row) => row.productId));
        return this.productOptions().filter((opt) => !taken.has(opt.value));
    });

    /** Per-row draft edits, keyed by product id. */
    priceDraft: Record<string, number | null> = {};
    quantityDraft: Record<string, number | null> = {};

    readonly addForm = this._formBuilder.nonNullable.group({
        productId: [''],
        initialPrice: [null as number | null],
        initialQuantity: [null as number | null],
    });

    ngOnInit(): void {
        this.load();
        this._catalog
            .listProducts()
            .then((products) =>
                this.productOptions.set(
                    products
                        .filter((p) => !!p.id)
                        .map((p) => ({
                            value: p.id,
                            label: String(p['name'] ?? ''),
                        }))
                )
            )
            .catch(() => this.productOptions.set([]));
    }

    load(): void {
        if (!this.marketId) {
            return;
        }
        this.loading.set(true);
        this._catalog
            .listMarketProducts(this.marketId)
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
                    this.marketId,
                    row.productId,
                    price
                )
            );
        }
        if (quantity != null && quantity !== row.quantity) {
            tasks.push(
                this._catalog.updateMarketQuantity(
                    this.marketId,
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

    addProduct(): void {
        const { productId, initialPrice, initialQuantity } =
            this.addForm.getRawValue();
        if (!productId) {
            return;
        }
        this.saving.set(true);
        this._catalog
            .addMarketProduct(
                this.marketId,
                productId,
                num(initialPrice),
                num(initialQuantity)
            )
            .then(() => {
                this._notify('admin.crud.createSuccess');
                this.addForm.reset({
                    productId: '',
                    initialPrice: null,
                    initialQuantity: null,
                });
                this.load();
            })
            .catch(() => this._notify('admin.crud.saveError'))
            .finally(() => this.saving.set(false));
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
