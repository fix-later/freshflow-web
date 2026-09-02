import { NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { settleWithLimit } from 'app/core/util/concurrency';
import { includesFolded } from 'app/core/util/text-search';
import {
    CatalogTag,
    MAX_MARKET_PRODUCT_TAGS,
} from 'app/modules/catalog/catalog.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import {
    ADMIN_DEFAULT_PAGE_SIZE,
    ADMIN_PAGE_SIZE_OPTIONS,
} from '../shared/admin-pagination';
import { CrudRow } from '../shared/resource-crud.types';
import { TableSort } from '../shared/table-sort';
import { CatalogAdminService } from './catalog-admin.service';

interface MarketProductRow {
    productId: string;
    name: string;
    /** Product photo (`MarketProductItemDto.ImageUrl`), may be empty. */
    imageUrl: string;
    /** The product's own category — a name, denormalised on the product row. */
    category: string;
    /** Selling unit, for labelling the quantity on the price-history screen. */
    unit: string;
    price: number | null;
    quantity: number | null;
    /** Catalog tags assigned to this listing (`MarketProductTagDto`). */
    tags: CatalogTag[];
}

interface ProductSelectionRow {
    id: string;
    name: string;
    category: string;
    unit: string;
    description: string;
}

/**
 * What one listing's drafts differ from what the server holds — the unit this
 * screen saves in.
 *
 * Each field is `null` when that field was not touched, which is also what the
 * write path reads: a field left alone issues no call at all, so an admin who
 * retypes a price does not silently rewrite the quantity or replace the tag set
 * with an identical one.
 */
interface RowChange {
    row: MarketProductRow;
    price: number | null;
    quantity: number | null;
    tagIds: string[] | null;
}

/**
 * Reads `MarketProductItemDto.Tags` — `{ id, name, pinsToTop }` objects since
 * SCRUM-386. Entries without an id are dropped: the write path sends ids, so a
 * tag this screen cannot identify is one it could not save back either, and
 * showing it would invite an agent to "keep" something that silently vanishes.
 */
function readTagList(value: unknown): CatalogTag[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter(
            (entry): entry is Record<string, unknown> =>
                !!entry && typeof entry === 'object'
        )
        .map((entry) => ({
            id: String(entry['id'] ?? ''),
            name: String(entry['name'] ?? ''),
            pinsToTop: entry['pinsToTop'] === true,
        }))
        .filter((tag) => !!tag.id);
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

/** Distinct non-empty names, alphabetical — what every filter select shows. */
function sortedNames(values: readonly string[]): string[] {
    return [...new Set(values.filter((name) => !!name))].sort((a, b) =>
        a.localeCompare(b)
    );
}

/**
 * At or below how many units a listing reads as "thiếu hàng" in the stock
 * filter.
 *
 * Neither the API nor the specs carry a restock point per listing, so this is
 * the screen's own line, named once here rather than left as a bare number
 * inside the filter — and the option carries the number, so nobody has to
 * guess what the filter just did.
 */
const LOW_STOCK_THRESHOLD = 10;

/** Two tag-id sets as one comparable string — order carries no meaning. */
function tagKey(ids: readonly string[]): string {
    return [...ids].sort().join(' ');
}

/**
 * How many listings the batch save has in flight at once.
 *
 * A market-wide sweep can touch dozens of rows, and each one is up to three
 * calls; firing them all at once only moves the queue into the browser's
 * connection pool, where neither the progress bar nor the server sees it.
 */
const SAVE_CONCURRENCY = 4;

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
        MatPaginatorModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        TranslocoModule,
    ],
    styles: [
        `
            /* Actions column carries the pin indicator + history + undo. */
            .market-products-grid {
                /* thumb | product | price | quantity | tags | actions */
                grid-template-columns:
                    3.25rem minmax(0, 1.2fr) 8.5rem 8.5rem minmax(0, 1fr)
                    9.5rem;

                @screen lg {
                    /* … + category and unit, which need the room to earn a column */
                    grid-template-columns:
                        3.25rem minmax(0, 1.2fr) minmax(0, 1fr) 7rem 8.5rem
                        8.5rem minmax(0, 1fr) 9.5rem;
                }
            }

            /*
             * An edited row, until the batch is saved. Amber at low alpha plus
             * a bar down the edge rather than a solid fill: it has to read as
             * "unsaved" against both themes and still leave the row's own text
             * legible, since it is the row you are in the middle of typing in.
             */
            .market-products-grid.is-changed {
                background-color: rgb(245 158 11 / 0.08);
                box-shadow: inset 3px 0 0 0 rgb(245 158 11);
            }

            .market-products-grid .product-thumb {
                width: 2.5rem;
                height: 2.5rem;
                flex: 0 0 auto;
                border-radius: 0.5rem;
                object-fit: cover;
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
    private readonly _confirmation = inject(FuseConfirmationService);

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

    /**
     * Header filters: the category pair (parent, then child), a stock band and
     * one catalog tag. All four narrow the same list, and combine with the
     * search box.
     */
    readonly parentCategoryFilter = signal('');
    readonly categoryFilter = signal('');
    readonly stockFilter = signal('');
    readonly tagFilter = signal('');

    readonly lowStockThreshold = LOW_STOCK_THRESHOLD;

    /**
     * Where a listing files at the top level: its category's parent, or the
     * category itself when that is already top-level. A product filed straight
     * under "Rau" has to survive a "Rau" filter the same as one under
     * "Rau ▸ Rau ăn lá", or the parent select would hide rows it names.
     *
     * When the category catalog failed to load the map is empty and every
     * category reads as its own parent — the parent select then behaves like
     * the flat one it replaced, rather than filtering everything away.
     */
    private _parentCategoryOf(row: MarketProductRow): string {
        return this.parentByCategory().get(row.category) || row.category;
    }

    /** Top-level categories at this chợ — filtering by any other is empty. */
    readonly parentCategoryOptions = computed(() =>
        sortedNames(this.rows().map((row) => this._parentCategoryOf(row)))
    );

    /**
     * Child categories, narrowed to the picked parent. Only categories that
     * actually sit under one are offered: a top-level category is already in
     * the parent select, and listing it as a child of itself would read as a
     * second, different filter that does the same thing.
     */
    readonly categoryOptions = computed(() => {
        const parent = this.parentCategoryFilter();
        const parentByCategory = this.parentByCategory();
        return sortedNames(
            this.rows()
                .filter((row) => {
                    const own = parentByCategory.get(row.category) ?? '';
                    return !!own && (!parent || own === parent);
                })
                .map((row) => row.category)
        );
    });

    /** Tags in use at this chợ — the catalog at large would filter to nothing. */
    readonly tagFilterOptions = computed(() => {
        const nameById = new Map<string, string>();
        for (const row of this.rows()) {
            for (const tag of row.tags) {
                if (!nameById.has(tag.id)) {
                    nameById.set(tag.id, tag.name);
                }
            }
        }
        return [...nameById]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    });

    readonly hasActiveFilters = computed(
        () =>
            !!this.parentCategoryFilter() ||
            !!this.categoryFilter() ||
            !!this.stockFilter() ||
            !!this.tagFilter()
    );

    readonly filteredRows = computed(() => {
        const term = this.search().trim();
        const parentCategory = this.parentCategoryFilter();
        const category = this.categoryFilter();
        const stock = this.stockFilter();
        const tagId = this.tagFilter();
        const changed = this.changedIds();
        // Reviewing a batch overrides the other filters rather than joining
        // them: the toolbar counts every edited listing, and a category picked
        // ten minutes ago quietly hiding three of them is how a batch gets
        // saved without its author ever seeing what was in it.
        if (this.changedOnly()) {
            return this.rows().filter((row) => changed.has(row.productId));
        }
        return this.rows().filter((row) => {
            if (term && !includesFolded(row.name, term)) {
                return false;
            }
            if (
                parentCategory &&
                this._parentCategoryOf(row) !== parentCategory
            ) {
                return false;
            }
            if (category && row.category !== category) {
                return false;
            }
            if (tagId && !row.tags.some((tag) => tag.id === tagId)) {
                return false;
            }
            if (!stock) {
                return true;
            }
            // A listing with no quantity recorded reads as out of stock: it is
            // the same thing to a buyer, and to the picker that seeds it at 0.
            const quantity = row.quantity ?? 0;
            if (stock === 'out') {
                return quantity <= 0;
            }
            // "Thiếu hàng" is a band inside "còn hàng", not a third state
            // beside it: 3 of 10 is still sellable, and dropping those rows out
            // of the in-stock list to keep the bands disjoint would misreport
            // what the chợ has.
            if (stock === 'low') {
                return quantity > 0 && quantity <= LOW_STOCK_THRESHOLD;
            }
            return quantity > 0;
        });
    });

    /**
     * Only the three columns that carry a sort header are sortable. Spelled out
     * rather than indexing the row blindly: `tags` is an array, which has no
     * meaningful order, and a blind accessor would happily hand it to the
     * comparator if a header were ever added for it.
     */
    readonly sortedRows = computed(() =>
        this.sort.apply(this.filteredRows(), (row, key) => {
            switch (key) {
                case 'name':
                    return row.name;
                case 'category':
                    // Parent first, so a sort groups the children under it.
                    return `${this.categoryParent(row)} ${row.category}`.trim();
                case 'unit':
                    return row.unit;
                case 'price':
                    return row.price;
                case 'quantity':
                    return row.quantity;
                default:
                    return null;
            }
        })
    );

    // ── Pagination ───────────────────────────────────────────────────────
    //
    // Client-side, over the sorted list, matching the markets list this tab
    // sits inside. The search, category and stock filters all run across the
    // whole inventory, so paging the fetch instead would narrow them to
    // whichever page happened to be open — a filter that answers "no matches"
    // while the match sits on page three is worse than no filter.

    readonly pageIndex = signal(0);
    readonly pageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    readonly pageSizeOptions = ADMIN_PAGE_SIZE_OPTIONS;

    /** Counts what the filters left, not the whole inventory. */
    readonly totalCount = computed(() => this.filteredRows().length);

    readonly pagedRows = computed(() => {
        const start = this.pageIndex() * this.pageSize();
        return this.sortedRows().slice(start, start + this.pageSize());
    });

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
    }

    /**
     * Back to the first page whenever the list underneath changes shape.
     * Without it a filter applied from page four shows an empty table: the
     * offset outlives the rows it was an offset into.
     */
    private _resetPaging(): void {
        this.pageIndex.set(0);
    }

    /** Pulls the open page back onto the list when the list has shrunk under it. */
    private _clampPaging(): void {
        const lastPage = Math.max(
            0,
            Math.ceil(this.totalCount() / this.pageSize()) - 1
        );
        if (this.pageIndex() > lastPage) {
            this.pageIndex.set(lastPage);
        }
    }

    // ── Drafts ───────────────────────────────────────────────────────────
    //
    // Signals, not plain objects: what is unsaved is derived from them (see
    // {@link pendingChanges}), and a `Record` mutated in place would leave the
    // count, the row highlight and the save button reading a stale edit.
    //
    // Keyed by product id and kept for the whole inventory, so an edit survives
    // paging, sorting and filtering — the batch is the market, not the page.

    /** Per-row draft edits, keyed by product id. */
    readonly priceDraft = signal<Record<string, number | null>>({});
    readonly quantityDraft = signal<Record<string, number | null>>({});
    /**
     * Drafted tag **ids** per product id.
     *
     * Ids, not typed text: tags are a shared catalog now
     * (`PUT .../tags` binds `TagIds`), so this is a selection from
     * {@link tagCatalog} rather than free input. An agent who needs a tag that
     * does not exist has to have it created in Admin ▸ Catalog ▸ Tags — which
     * is the point of a controlled vocabulary.
     */
    readonly tagsDraft = signal<Record<string, string[]>>({});

    setPriceDraft(productId: string, value: number | null): void {
        this.priceDraft.update((draft) => ({ ...draft, [productId]: value }));
    }

    setQuantityDraft(productId: string, value: number | null): void {
        this.quantityDraft.update((draft) => ({
            ...draft,
            [productId]: value,
        }));
    }

    setTagsDraft(productId: string, value: string[]): void {
        this.tagsDraft.update((draft) => ({ ...draft, [productId]: value }));
    }

    // ── Pending changes ──────────────────────────────────────────────────
    //
    // Editing and saving are separate acts here: a row is edited in place and
    // nothing is written until the batch is saved, at which point only the
    // fields that actually differ are sent. Which is why every one of these is
    // a diff against {@link rows} — the last thing the server told us — rather
    // than a "touched" flag, so an edit typed back to its original value costs
    // no request.

    /**
     * Listings whose drafts differ from the stored row.
     *
     * Wider than {@link pendingChanges} on purpose: a cleared price is an edit
     * the admin can see and undo, so it counts as changed and highlights its
     * row, even though there is nothing valid to write for it.
     */
    readonly changedIds = computed(() => {
        const ids = new Set<string>();
        for (const row of this.rows()) {
            if (this._differsFromStored(row)) {
                ids.add(row.productId);
            }
        }
        return ids;
    });

    readonly changedCount = computed(() => this.changedIds().size);

    /** What the batch would write, one entry per edited listing, in list order. */
    readonly pendingChanges = computed<RowChange[]>(() =>
        this.rows()
            .map((row) => this._changeFor(row))
            .filter((change): change is RowChange => change !== null)
    );

    /**
     * Listings whose edits the server would reject, keyed to the reason.
     *
     * Checked here rather than left to the API because a batch is all-or-
     * nothing to the person who typed it: one row with a price of 0 would come
     * back as a partial failure after the other forty had already been written.
     */
    readonly rowErrors = computed(() => {
        const errors = new Map<string, string>();
        for (const row of this.rows()) {
            const key =
                this._priceQuantityErrorKey(row) ??
                this.tagsErrorKey(row.productId);
            if (key) {
                errors.set(row.productId, key);
            }
        }
        return errors;
    });

    readonly invalidCount = computed(() => this.rowErrors().size);

    readonly canSaveAll = computed(
        () =>
            this.changedCount() > 0 &&
            this.invalidCount() === 0 &&
            !this.saving()
    );

    isChanged(productId: string): boolean {
        return this.changedIds().has(productId);
    }

    /**
     * The reason this row cannot be saved, as an i18n key — price and quantity
     * only. A tag overflow reports itself under the tag picker instead, so the
     * message sits next to the control that caused it.
     */
    rowErrorKey(productId: string): string | null {
        const key = this.rowErrors().get(productId) ?? null;
        return key === 'admin.markets.pricing.tagsTooMany' ? null : key;
    }

    /** Localized reason the last batch save was rejected, kept next to it. */
    readonly saveError = signal<string | null>(null);

    /** Narrows the grid to the edited rows, for reviewing a batch before saving. */
    readonly changedOnly = signal(false);

    toggleChangedOnly(): void {
        this.changedOnly.update((on) => !on);
        this._resetPaging();
    }

    /** Whether any of this listing's drafts has moved off the stored value. */
    private _differsFromStored(row: MarketProductRow): boolean {
        return (
            num(this.priceDraft()[row.productId]) !== row.price ||
            num(this.quantityDraft()[row.productId]) !== row.quantity ||
            tagKey(this.draftTags(row.productId)) !==
                tagKey(row.tags.map((tag) => tag.id))
        );
    }

    /**
     * What one listing would write, or null when it is untouched.
     *
     * Reads the drafts as signals, so every derivation above recomputes as the
     * admin types rather than on the next change-detection pass that happens to
     * come along.
     */
    private _changeFor(row: MarketProductRow): RowChange | null {
        const price = num(this.priceDraft()[row.productId]);
        const quantity = num(this.quantityDraft()[row.productId]);
        const tagIds = this.draftTags(row.productId);
        const change: RowChange = {
            row,
            price: price !== null && price !== row.price ? price : null,
            quantity:
                quantity !== null && quantity !== row.quantity
                    ? quantity
                    : null,
            // Tags go as a whole set (the endpoint replaces, it does not merge),
            // so the drafted set is sent only when it is a different set.
            tagIds:
                tagKey(tagIds) !== tagKey(row.tags.map((tag) => tag.id))
                    ? tagIds
                    : null,
        };
        return change.price === null &&
            change.quantity === null &&
            change.tagIds === null
            ? null
            : change;
    }

    /**
     * Client-side verdict on an edited row's price and quantity, mirroring the
     * handler (`> 0`, `>= 0`) and the validator (`<= MaxPriceVnd`, at most two
     * decimals, whole quantities).
     *
     * Only rows whose value the admin has moved are judged: a listing the
     * server itself returned without a price is not this screen's error to
     * report, and flagging it would block a batch over a row nobody touched.
     */
    private _priceQuantityErrorKey(row: MarketProductRow): string | null {
        const price = num(this.priceDraft()[row.productId]);
        if (price !== row.price) {
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
        }
        const quantity = num(this.quantityDraft()[row.productId]);
        if (quantity !== row.quantity) {
            if (quantity === null) {
                return 'admin.markets.pricing.quantityRequired';
            }
            if (quantity < 0) {
                return 'admin.markets.pricing.quantityNonNegative';
            }
            if (!Number.isInteger(quantity)) {
                return 'admin.markets.pricing.quantityInteger';
            }
        }
        return null;
    }

    /** The tag catalog, loaded once — the source for every row's picker. */
    readonly tagCatalog = signal<CatalogTag[]>([]);
    /** category name → parent category name, for the two-line category cell. */
    readonly parentByCategory = signal<Map<string, string>>(new Map());
    readonly loadingTags = signal(false);

    readonly maxTags = MAX_MARKET_PRODUCT_TAGS;

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
        this._loadTagCatalog();
        this._loadCategoryParents();
    }

    /**
     * Parent of a product's category, or '' when the category is top-level or
     * unknown. The listing carries the category as a **name**, so the lookup is
     * by name; the catalog is small and loaded once.
     */
    categoryParent(row: MarketProductRow): string {
        return this.parentByCategory().get(row.category) ?? '';
    }

    goBack(): void {
        if (this.embedded()) {
            return;
        }
        void this._router.navigate(['/admin/markets']);
    }

    onSearch(value: string): void {
        this.search.set(value);
        this._resetPaging();
    }

    setParentCategoryFilter(value: string): void {
        this.parentCategoryFilter.set(value);
        // A child of the parent just left behind would match nothing, and the
        // select would go on showing it as active over an empty table.
        if (!this.categoryOptions().includes(this.categoryFilter())) {
            this.categoryFilter.set('');
        }
        this._resetPaging();
    }

    setCategoryFilter(value: string): void {
        this.categoryFilter.set(value);
        this._resetPaging();
    }

    setStockFilter(value: string): void {
        this.stockFilter.set(value);
        this._resetPaging();
    }

    setTagFilter(value: string): void {
        this.tagFilter.set(value);
        this._resetPaging();
    }

    clearFilters(): void {
        this.parentCategoryFilter.set('');
        this.categoryFilter.set('');
        this.stockFilter.set('');
        this.tagFilter.set('');
        this._resetPaging();
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
                    // Keep whatever the grid has drafted: listing new products
                    // is a different act from editing the ones already here,
                    // and it must not quietly throw the other one away.
                    this.load(this.changedIds());
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
                this.load(this.changedIds());
            })
            .finally(() => this.saving.set(false));
    }

    /**
     * Re-reads the inventory and reseeds the drafts from it.
     *
     * `keepDraftsFor` holds back that reseeding for listings the caller knows
     * are still unsaved — the rows a partial batch failed on. Without it the
     * refresh that follows a failure would overwrite exactly the edits the
     * admin now has to retry.
     */
    load(keepDraftsFor?: ReadonlySet<string>): void {
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
                // The open page may no longer exist — a quick-add reload can
                // return fewer rows than the offset it is read at.
                this._clampPaging();
                this._seedDrafts(mapped, keepDraftsFor);
            })
            .catch(() => {
                this.rows.set([]);
                this._seedDrafts([]);
                this._notify('admin.crud.loadError');
            })
            .finally(() => this.loading.set(false));
    }

    /**
     * Points every draft back at the stored row, except for the listings named
     * in `keep`. Rebuilt rather than merged so drafts for listings that are no
     * longer at this chợ do not linger and count as pending changes forever.
     */
    private _seedDrafts(
        rows: readonly MarketProductRow[],
        keep?: ReadonlySet<string>
    ): void {
        const prices = this.priceDraft();
        const quantities = this.quantityDraft();
        const tags = this.tagsDraft();
        const nextPrices: Record<string, number | null> = {};
        const nextQuantities: Record<string, number | null> = {};
        const nextTags: Record<string, string[]> = {};
        for (const row of rows) {
            const id = row.productId;
            const kept = keep?.has(id) === true;
            nextPrices[id] = kept && id in prices ? prices[id] : row.price;
            nextQuantities[id] =
                kept && id in quantities ? quantities[id] : row.quantity;
            nextTags[id] =
                kept && id in tags ? tags[id] : row.tags.map((tag) => tag.id);
        }
        this.priceDraft.set(nextPrices);
        this.quantityDraft.set(nextQuantities);
        this.tagsDraft.set(nextTags);
    }

    /**
     * Opens the recorded price/quantity changes for this listing.
     *
     * Asks first when the grid has unsaved edits: this is the one control on
     * the screen that leaves it, and the batch does not survive the trip.
     */
    openPriceHistory(row: MarketProductRow): void {
        if (!this.changedCount()) {
            this._goToPriceHistory(row);
            return;
        }
        const ref = this._confirmation.open({
            title: this._transloco.translate(
                'admin.markets.pricing.leaveTitle'
            ),
            message: this._transloco.translate(
                'admin.markets.pricing.leaveMessage',
                { count: this.changedCount() }
            ),
            actions: {
                confirm: {
                    label: this._transloco.translate(
                        'admin.markets.pricing.leaveConfirm'
                    ),
                    color: 'warn',
                },
            },
        });
        ref.afterClosed().subscribe((result) => {
            if (result === 'confirmed') {
                this._goToPriceHistory(row);
            }
        });
    }

    /**
     * The names travel in navigation state so the screen can title itself
     * immediately; it re-fetches them when opened by deep link, so this is an
     * optimisation rather than the only source.
     */
    private _goToPriceHistory(row: MarketProductRow): void {
        void this._router.navigate(
            [
                '/admin/markets',
                this.effectiveMarketId(),
                'products',
                row.productId,
                'price-history',
            ],
            {
                state: {
                    priceHistoryContext: {
                        marketName: this.marketName(),
                        productName: row.name,
                        unit: row.unit,
                    },
                },
            }
        );
    }

    /** The tag ids currently drafted for a row. */
    draftTags(productId: string): string[] {
        return this.tagsDraft()[productId] ?? [];
    }

    /**
     * Client-side verdict on a row's drafted tags, as an i18n key. Mirrors
     * `SetMarketProductTagsCommandValidator` (≤ 8 tags), so a rejected set
     * never reaches the server. The per-tag length rule now lives on the tag
     * itself and is enforced where tags are created, not here.
     */
    tagsErrorKey(productId: string): string | null {
        return this.draftTags(productId).length > MAX_MARKET_PRODUCT_TAGS
            ? 'admin.markets.pricing.tagsTooMany'
            : null;
    }

    /**
     * Whether the drafted set pins this listing to the top of the board.
     *
     * Read off the catalog rather than a tag name: pinning is `pinsToTop` on
     * the tag, so which tags pin is decided in Admin ▸ Catalog ▸ Tags and can
     * change without this screen knowing any particular name.
     */
    isFeaturedRow(row: MarketProductRow): boolean {
        const pinning = new Set(
            this.tagCatalog()
                .filter((tag) => tag.pinsToTop)
                .map((tag) => tag.id)
        );
        return this.draftTags(row.productId).some((id) => pinning.has(id));
    }

    /** Display name for a tag id, for the row's summary line. */
    tagName(tagId: string): string {
        return this.tagCatalog().find((tag) => tag.id === tagId)?.name ?? tagId;
    }

    /** Puts one listing's drafts back to what the server holds. */
    revertRow(productId: string): void {
        const row = this.rows().find((item) => item.productId === productId);
        if (!row || this.saving()) {
            return;
        }
        this.setPriceDraft(productId, row.price);
        this.setQuantityDraft(productId, row.quantity);
        this.setTagsDraft(
            productId,
            row.tags.map((tag) => tag.id)
        );
        this._afterDraftsSettled();
    }

    /** Drops every unsaved edit across the inventory. */
    discardAll(): void {
        if (this.saving() || !this.changedCount()) {
            return;
        }
        this._seedDrafts(this.rows());
        this.saveError.set(null);
        this._afterDraftsSettled();
    }

    /**
     * Writes every edited listing in one go.
     *
     * Per listing rather than per field: the three endpoints behind a row are
     * an implementation detail of this screen, and an admin who retyped a price
     * and a quantity means one change to one product. Failures are reported the
     * same way — "3 of 40 listings could not be saved" — because that is the
     * unit they can go back and fix.
     */
    saveAll(): void {
        if (!this.canSaveAll()) {
            return;
        }
        const changes = this.pendingChanges();
        this.saveError.set(null);
        this.saving.set(true);
        void settleWithLimit(changes, SAVE_CONCURRENCY, (change) =>
            this._writeChange(change)
        )
            .then(async (results) => {
                const failures = results.filter(
                    (result): result is PromiseRejectedResult =>
                        result.status === 'rejected'
                );
                if (!failures.length) {
                    this._notify('admin.crud.updateSuccess');
                    // Nothing left to review, so the review filter goes with
                    // it — otherwise the grid empties out under the admin.
                    this.changedOnly.set(false);
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
                this.saveError.set(
                    this._transloco.translate(
                        'admin.markets.pricing.savePartial',
                        { failed: failures.length, total: results.length }
                    ) + ` ${reason}`
                );
                // Refresh so the listings that landed show their new values,
                // while the ones that did not keep the edits to retry.
                this.load(
                    new Set(
                        changes
                            .filter(
                                (_, index) =>
                                    results[index].status === 'rejected'
                            )
                            .map((change) => change.row.productId)
                    )
                );
            })
            .finally(() => this.saving.set(false));
    }

    /**
     * One listing's writes, in sequence: price, then quantity, then tags. Not
     * `Promise.all` — the three land in the same row, and a listing that fails
     * halfway is easier to reason about than one where two of three raced.
     */
    private async _writeChange(change: RowChange): Promise<void> {
        const marketId = this.effectiveMarketId();
        const productId = change.row.productId;
        if (change.price !== null) {
            await this._catalog.updateMarketPrice(
                marketId,
                productId,
                change.price
            );
        }
        if (change.quantity !== null) {
            await this._catalog.updateMarketQuantity(
                marketId,
                productId,
                change.quantity
            );
        }
        if (change.tagIds !== null) {
            await this._catalog.setMarketProductTags(
                marketId,
                productId,
                change.tagIds
            );
        }
    }

    /**
     * Leaves the review filter when there is nothing left to review, so
     * discarding or reverting the last edit does not strand the admin on an
     * empty grid with no obvious way back to the inventory.
     */
    private _afterDraftsSettled(): void {
        if (this.changedOnly() && !this.changedCount()) {
            this.changedOnly.set(false);
        }
        this._clampPaging();
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
        const sellingUnit = (row['sellingUnit'] ?? null) as Record<
            string,
            unknown
        > | null;
        return {
            productId: String(row['productId'] ?? row.id ?? ''),
            name: String(row['productName'] ?? row['name'] ?? ''),
            imageUrl: String(row['imageUrl'] ?? ''),
            category: String(row['category'] ?? row['categoryName'] ?? ''),
            unit: String(row['unit'] ?? sellingUnit?.['unitName'] ?? ''),
            price: num(row['price'] ?? row['currentPrice']),
            quantity: num(row['availableQuantity'] ?? row['quantity']),
            tags: readTagList(row['tags']),
        };
    }

    private _loadCategoryParents(): void {
        void this._catalog
            .listCategories()
            .then((rows) =>
                this.parentByCategory.set(
                    new Map(
                        rows.map((row): [string, string] => [
                            String(row['name'] ?? ''),
                            String(row['parentName'] ?? '').trim(),
                        ])
                    )
                )
            )
            // Without it the cell shows the leaf category alone, which is still
            // correct — just less context.
            .catch(() => this.parentByCategory.set(new Map()));
    }

    private _loadTagCatalog(): void {
        this.loadingTags.set(true);
        void this._catalog
            .listTags()
            .then((rows) =>
                this.tagCatalog.set(
                    rows
                        .filter((row) => !!row.id)
                        .map((row) => ({
                            id: row.id,
                            name: String(row['name'] ?? ''),
                            pinsToTop: row['pinsToTop'] === true,
                        }))
                )
            )
            // An empty catalog only disables the picker; price and quantity
            // editing stand on their own and must not go down with it.
            .catch(() => this.tagCatalog.set([]))
            .finally(() => this.loadingTags.set(false));
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }
}
