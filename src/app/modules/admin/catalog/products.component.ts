import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnInit,
    TemplateRef,
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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import {
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    nonBlankValidator,
    trimmedMaxLengthValidator,
} from 'app/core/api/validators';
import { includesFolded } from 'app/core/util/text-search';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import {
    ADMIN_DEFAULT_PAGE_SIZE,
    toApiPage,
    toPageIndex,
} from '../shared/admin-pagination';
import { CrudOption, CrudRow } from '../shared/resource-crud.types';
import { TableSort } from '../shared/table-sort';
import {
    CatalogAdminService,
    PRODUCT_DESCRIPTION_MAX_LENGTH,
    PRODUCT_NAME_MAX_LENGTH,
} from './catalog-admin.service';
import {
    PRODUCT_VAT_RATES,
    vatRateLabel,
    vatRateOf,
    vatRateShortLabel,
} from './product-vat';

/**
 * Admin ▸ Catalog ▸ Products — inventory-style list with inline detail editor
 * (same pattern as markets / Fuse ecommerce inventory).
 */
@Component({
    selector: 'admin-products',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatAutocompleteModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
    templateUrl: './products.component.html',
    styles: [
        `
            .products-grid {
                /* image | name | actions — matches cells visible below sm */
                grid-template-columns: 4rem minmax(0, 1fr) 6rem;

                @screen sm {
                    /* image | name | category | actions — content cols even */
                    grid-template-columns: 4rem minmax(0, 1fr) minmax(0, 1fr) 6rem;
                }

                @screen md {
                    /* image | name | category | unit | actions — content cols even */
                    grid-template-columns:
                        4rem minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)
                        6rem;
                }

                @screen lg {
                    /* … + VAT, which is short enough to earn a fixed track */
                    grid-template-columns:
                        4rem minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 7rem
                        6rem;
                }
            }
        `,
    ],
})
export class ProductsComponent implements OnInit {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _dialog = inject(MatDialog);
    private readonly _confirmation = inject(FuseConfirmationService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _destroyRef = inject(DestroyRef);

    private _editDialogRef: MatDialogRef<unknown> | null = null;

    readonly rows = signal<CrudRow[]>([]);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly uploading = signal(false);
    readonly dragOver = signal(false);
    /** Image URL shown in the enlarged-preview dialog. */
    readonly previewImageUrl = signal('');
    readonly search = signal('');
    /** Page-level category filter (parent → child cascade, like the dialog). */
    readonly filterParentId = signal('');
    readonly filterChildId = signal('');
    readonly pageIndex = signal(0);
    readonly pageSize = signal(ADMIN_DEFAULT_PAGE_SIZE);
    /** Total matching products across all pages (from the server). */
    readonly totalCount = signal(0);
    /** Debounce handle for the server-side search box. */
    private _searchTimer?: ReturnType<typeof setTimeout>;
    readonly selectedId = signal<string | null>(null);
    /** Full row backing the edit dialog (for read-only meta: status/dates/id). */
    readonly selectedRow = signal<CrudRow | null>(null);
    readonly flashMessage = signal<'success' | 'error' | null>(null);
    readonly sort = new TableSort<CrudRow>();
    readonly unitOptions = signal<CrudOption[]>([]);
    readonly packingCodeOptions = signal<CrudOption[]>([]);

    /** All active categories (carry `parentId`) — feed the cascade selects. */
    readonly activeCategoryRows = signal<CrudRow[]>([]);
    /** Parent category chosen in the edit dialog. */
    readonly editParentId = signal('');
    /** In-dropdown search term for the sub-category select. */
    readonly editChildSearch = signal('');

    /** Top-level active categories (no parent) — the "parent" dropdown. */
    readonly parentCategoryOptions = computed(() =>
        this.activeCategoryRows()
            .filter((c) => !String(c['parentId'] ?? '').trim())
            .map((c) => ({ value: c.id, label: String(c['name'] ?? '') }))
    );
    /** Active sub-categories of the parent chosen in the edit dialog. */
    readonly editChildOptions = computed(() =>
        this._childOptions(this.editParentId())
    );
    /** Sub-categories of the parent chosen in the page filter. */
    readonly filterChildOptions = computed(() =>
        this._childOptions(this.filterParentId())
    );

    // Mirrors `UpdateProductCommandValidator`, which shares its rules with the
    // create one: name `NotEmpty().MaximumLength(200)`, description ≤ 1000,
    // unit required.
    readonly selectedForm = new FormGroup({
        name: new FormControl('', {
            nonNullable: true,
            validators: [
                Validators.required,
                nonBlankValidator,
                trimmedMaxLengthValidator(PRODUCT_NAME_MAX_LENGTH),
            ],
        }),
        unitId: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        categoryId: new FormControl('', { nonNullable: true }),
        description: new FormControl('', {
            nonNullable: true,
            validators: [
                trimmedMaxLengthValidator(PRODUCT_DESCRIPTION_MAX_LENGTH),
            ],
        }),
        imageUrl: new FormControl('', { nonNullable: true }),
        packingCodeId: new FormControl('', { nonNullable: true }),
        /**
         * `''` is "chưa cấu hình", which the column stores as null — the write
         * path drops it rather than sending an empty code the validator would
         * refuse. Not required: a product may legitimately be listed before its
         * tax treatment has been decided.
         */
        vatRate: new FormControl('', { nonNullable: true }),
    });

    readonly vatRates = PRODUCT_VAT_RATES;

    /** The full label — the dialog's options, and the cell's tooltip. */
    vatRateLabel(code: string | null | undefined): string {
        return vatRateLabel(code, (key) => this._transloco.translate(key));
    }

    /** The code alone, for the table cell. */
    vatRateShortLabel(code: string | null | undefined): string {
        return vatRateShortLabel(code, (key) => this._transloco.translate(key));
    }

    vatRateOf(row: CrudRow): string {
        return vatRateOf(row['vatRate']);
    }

    /**
     * The current server page in the active client-side sort order. Search,
     * category filtering and paging are done by the backend (one page loaded at
     * a time); sorting reorders the loaded page.
     */
    readonly sortedRows = computed(() =>
        this.sort.apply(this.rows(), (row, key) => {
            if (key === 'category') {
                return String(row['categoryName'] ?? '');
            }
            if (key === 'unit') {
                return String(row['unitName'] ?? row['unitAbbreviation'] ?? '');
            }
            return String(row[key] ?? '');
        })
    );

    readonly hasActiveFilters = computed(
        () =>
            this.search().trim() !== '' ||
            this.filterParentId() !== '' ||
            this.filterChildId() !== ''
    );

    ngOnInit(): void {
        this.load();
        void this._loadOptions();
    }

    /** Loads the current page from the server (search / category / page). */
    load(): void {
        this.loading.set(true);
        const categoryId =
            this.filterChildId() || this.filterParentId() || undefined;
        this._catalog
            .listProducts({
                page: toApiPage(this.pageIndex()),
                pageSize: this.pageSize(),
                search: this.search().trim() || undefined,
                categoryId,
            })
            .then(({ rows, total, page, pageSize }) => {
                this.rows.set(rows);
                this.totalCount.set(total);
                // Track the page/size the backend actually returned.
                if (page) {
                    this.pageIndex.set(toPageIndex(page));
                }
                if (pageSize) {
                    this.pageSize.set(pageSize);
                }
            })
            .catch((err) => void this._notifyError(err, 'admin.crud.loadError'))
            .finally(() => this.loading.set(false));
    }

    onSearch(value: string): void {
        this.search.set(value);
        // Debounce so typing doesn't fire a request per keystroke.
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
            this.pageIndex.set(0);
            this.closeDetails();
            this.load();
        }, 350);
    }

    /** Pick a parent filter → reset the sub-category filter so it re-narrows. */
    onFilterParentChange(id: string): void {
        this.filterParentId.set(id);
        this.filterChildId.set('');
        this.pageIndex.set(0);
        this.closeDetails();
        this.load();
    }

    /** Pick a sub-category filter → auto-fill its parent (like the dialog). */
    onFilterChildChange(id: string): void {
        this.filterChildId.set(id);
        const parent = this._parentOf(id);
        if (parent) {
            this.filterParentId.set(parent);
        }
        this.pageIndex.set(0);
        this.closeDetails();
        this.load();
    }

    clearFilters(): void {
        this.search.set('');
        this.filterParentId.set('');
        this.filterChildId.set('');
        this.pageIndex.set(0);
        this.closeDetails();
        this.load();
    }

    /** Sort reorders the current page only (server owns paging). */
    onSort(key: string): void {
        this.sort.toggle(key);
        this.closeDetails();
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
        this.closeDetails();
        this.load();
    }

    openEdit(row: CrudRow, template: TemplateRef<unknown>): void {
        this.selectedId.set(row.id);
        this.selectedRow.set(row);
        this.flashMessage.set(null);
        this.editChildSearch.set('');
        this._patchSelected(row);
        this._editDialogRef = this._dialog.open(template, {
            width: '720px',
            maxWidth: '95vw',
            autoFocus: 'first-tabbable',
        });
    }

    closeDetails(): void {
        this._editDialogRef?.close();
        this._editDialogRef = null;
        this.selectedId.set(null);
        this.selectedRow.set(null);
        this.editParentId.set('');
        this.editChildSearch.set('');
        this.flashMessage.set(null);
        this.selectedForm.reset({
            name: '',
            unitId: '',
            categoryId: '',
            description: '',
            imageUrl: '',
            packingCodeId: '',
            vatRate: '',
        });
    }

    /**
     * Creating and editing share one dialog: the fields are the same, and a
     * separate page for the same form was one more place for the two to drift.
     * `selectedId() === null` is what tells them apart — the image and the
     * read-only metadata belong to a product that already exists.
     */
    openCreate(template: TemplateRef<unknown>): void {
        this.selectedId.set(null);
        this.selectedRow.set(null);
        this.editParentId.set('');
        this.editChildSearch.set('');
        this.flashMessage.set(null);
        this.selectedForm.reset({
            name: '',
            unitId: '',
            categoryId: '',
            description: '',
            imageUrl: '',
            packingCodeId: '',
            vatRate: '',
        });
        this._editDialogRef = this._dialog.open(template, {
            width: '720px',
            maxWidth: '95vw',
            autoFocus: 'first-tabbable',
        });
    }

    /** Saves the dialog — create when there is no row behind it, else update. */
    submitSelected(): void {
        if (this.selectedId()) {
            this.updateSelected();
            return;
        }
        if (this.selectedForm.invalid) {
            this.selectedForm.markAllAsTouched();
            return;
        }
        const value = this.selectedForm.getRawValue();
        const payload = {
            ...value,
            categoryId: value.categoryId || this.editParentId(),
        };
        this.saving.set(true);
        this._catalog
            .createProduct(payload)
            // `CreateProductRequest` carries no image, so a picture chosen in
            // the dialog is written straight after, with the id the create just
            // handed back. Without an id there is nothing to attach it to.
            .then((productId) =>
                productId && payload.imageUrl
                    ? this._catalog.updateProduct(productId, payload)
                    : undefined
            )
            .then(() => {
                this._notify('admin.crud.createSuccess');
                this.closeDetails();
                this.load();
            })
            .catch((err) => {
                this.showFlashMessage('error');
                void this._notifyError(err, 'admin.crud.saveError');
            })
            .finally(() => this.saving.set(false));
    }

    onEditParentChange(parentId: string): void {
        this.editParentId.set(parentId);
        this.selectedForm.controls.categoryId.setValue('');
    }

    /** Type-to-search options for the sub-category autocomplete. */
    visibleChildOptions(): CrudOption[] {
        const options = this.editChildOptions();
        const term = this.editChildSearch().trim();
        const selectedId = this.selectedForm.controls.categoryId.value;
        // Empty box, or still showing the current selection → full list.
        if (!term || term === this._categoryLabel(selectedId)) {
            return options;
        }
        return options.filter((opt) => includesFolded(opt.label, term));
    }

    onChildSearch(term: string): void {
        this.editChildSearch.set(term);
    }

    /** Pick a sub-category → store it, show its label, auto-fill the parent. */
    onChildSelected(childId: string): void {
        this.selectedForm.controls.categoryId.setValue(childId);
        this.editChildSearch.set(this._categoryLabel(childId));
        const parent = this._parentOf(childId);
        if (parent) {
            this.editParentId.set(parent);
        }
    }

    /** On close, drop any unselected typed text — revert to the selection. */
    onChildBlur(): void {
        const id = this.selectedForm.controls.categoryId.value;
        this.editChildSearch.set(id ? this._categoryLabel(id) : '');
    }

    clearChild(): void {
        this.selectedForm.controls.categoryId.setValue('');
        this.editChildSearch.set('');
    }

    /** Maps the stored category id → its name for the autocomplete display. */
    readonly childLabel = (id: string): string => this._categoryLabel(id);

    private _categoryLabel(id: string): string {
        if (!id) {
            return '';
        }
        const cat = this.activeCategoryRows().find((c) => c.id === id);
        return cat ? String(cat['name'] ?? '') : '';
    }

    updateSelected(): void {
        const id = this.selectedId();
        if (!id || this.selectedForm.invalid) {
            this.selectedForm.markAllAsTouched();
            return;
        }
        const value = this.selectedForm.getRawValue();
        this.saving.set(true);
        this._catalog
            .updateProduct(id, {
                ...value,
                categoryId: value.categoryId || this.editParentId(),
            })
            .then(() => {
                this._notify('admin.crud.updateSuccess');
                this.closeDetails();
                this.load();
            })
            .catch((err) => {
                this.showFlashMessage('error');
                void this._notifyError(err, 'admin.crud.saveError');
            })
            .finally(() => this.saving.set(false));
    }

    deactivate(row: CrudRow): void {
        if (row['isDeleted'] === true) {
            return;
        }
        const id = row.id;

        const confirmation = this._confirmation.open({
            title: this._transloco.translate('admin.crud.confirmRemove.title'),
            message: this._transloco.translate(
                'admin.crud.confirmRemove.message'
            ),
            actions: {
                confirm: {
                    label: this._transloco.translate('admin.crud.deactivate'),
                },
            },
        });

        confirmation.afterClosed().subscribe((result) => {
            if (result !== 'confirmed') {
                return;
            }
            this.saving.set(true);
            this._catalog
                .deactivateProduct(id)
                .then(() => {
                    this._notify('admin.crud.removeSuccess');
                    this.closeDetails();
                    this.load();
                })
                .catch(
                    (err) => void this._notifyError(err, 'admin.crud.saveError')
                )
                .finally(() => this.saving.set(false));
        });
    }

    isInactive(row: CrudRow): boolean {
        return row['isDeleted'] === true;
    }

    unitLabel(row: CrudRow): string {
        return String(row['unitName'] ?? row['unitAbbreviation'] ?? '');
    }

    /** Assigned category rows keyed by id, for parent/child resolution. */
    private readonly _categoryById = computed(
        () => new Map(this.activeCategoryRows().map((c) => [c.id, c]))
    );

    /** The product's own (leaf) category name. */
    categoryChild(row: CrudRow): string {
        const cat = this._categoryById().get(String(row['categoryId'] ?? ''));
        return String(cat?.['name'] ?? row['categoryName'] ?? '');
    }

    /** Parent category name — empty when the product's category is top-level. */
    categoryParent(row: CrudRow): string {
        const cat = this._categoryById().get(String(row['categoryId'] ?? ''));
        return cat ? String(cat['parentName'] ?? '').trim() : '';
    }

    createdLabel(row: CrudRow): string {
        return this._formatDate(row['createdAt'] ?? row['createdDate']);
    }

    updatedLabel(row: CrudRow): string {
        return this._formatDate(
            row['updatedAt'] ?? row['updatedDate'] ?? row['modifiedAt']
        );
    }

    /** Locale-formatted date, or '' when the value is missing/unparseable. */
    private _formatDate(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleString(this._transloco.getActiveLang());
    }

    showFlashMessage(type: 'success' | 'error'): void {
        this.flashMessage.set(type);
        window.setTimeout(() => {
            if (this.flashMessage() === type) {
                this.flashMessage.set(null);
            }
        }, 3000);
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(true);
    }

    onDragLeave(): void {
        this.dragOver.set(false);
    }

    onImageDropped(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(false);
        const file = event.dataTransfer?.files?.[0];
        if (file) {
            void this._uploadImage(file);
        }
    }

    onImagePicked(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (file) {
            void this._uploadImage(file);
        }
    }

    clearImage(): void {
        this.selectedForm.controls.imageUrl.setValue('');
    }

    /** Opens the image in a large, click-to-close preview dialog. */
    openImagePreview(template: TemplateRef<unknown>, url: string): void {
        if (!url) {
            return;
        }
        this.previewImageUrl.set(url);
        this._dialog.open(template, {
            maxWidth: '95vw',
            maxHeight: '95vh',
            autoFocus: false,
            panelClass: 'image-preview-dialog',
        });
    }

    private async _uploadImage(file: File): Promise<void> {
        if (!file.type.startsWith('image/')) {
            this._notify('admin.crud.image.invalidType');
            return;
        }
        this.uploading.set(true);
        try {
            const url = await this._catalog.uploadProductImage(file);
            this.selectedForm.controls.imageUrl.setValue(url);
        } catch (err) {
            await this._notifyError(err, 'admin.crud.image.uploadError');
        } finally {
            this.uploading.set(false);
        }
    }

    private async _loadOptions(): Promise<void> {
        try {
            const [units, activeCategories, packingCodes] = await Promise.all([
                this._catalog.unitOptions(),
                this._catalog.listCategories(true),
                this._catalog.packingCodeOptions(),
            ]);
            this.unitOptions.set(units);
            this.activeCategoryRows.set(activeCategories);
            this.packingCodeOptions.set(packingCodes);
        } catch {
            this.unitOptions.set([]);
            this.activeCategoryRows.set([]);
            this.packingCodeOptions.set([]);
        }
    }

    /**
     * Sub-category options. Scoped to `parentId` when a parent is chosen;
     * otherwise every active sub-category, so a child can be picked first and
     * the parent auto-filled from it.
     */
    private _childOptions(parentId: string): CrudOption[] {
        return this.activeCategoryRows()
            .filter((c) => {
                const p = String(c['parentId'] ?? '').trim();
                return p !== '' && (!parentId || p === parentId);
            })
            .map((c) => ({ value: c.id, label: String(c['name'] ?? '') }));
    }

    /** Parent id of a category (empty if top-level or unknown). */
    private _parentOf(categoryId: string): string {
        if (!categoryId) {
            return '';
        }
        const cat = this.activeCategoryRows().find((c) => c.id === categoryId);
        return cat ? String(cat['parentId'] ?? '').trim() : '';
    }

    /**
     * Splits a product's stored `categoryId` into the parent to preselect and
     * the sub-category (if the stored category is itself a child). A top-level
     * category becomes the parent with no child selected.
     */
    private _resolveCategory(categoryId: string): {
        parentId: string;
        childId: string;
    } {
        const cat = this.activeCategoryRows().find((c) => c.id === categoryId);
        if (!cat) {
            return { parentId: '', childId: '' };
        }
        const parent = String(cat['parentId'] ?? '').trim();
        return parent
            ? { parentId: parent, childId: cat.id }
            : { parentId: cat.id, childId: '' };
    }

    private _patchSelected(row: CrudRow): void {
        const { parentId, childId } = this._resolveCategory(
            String(row['categoryId'] ?? '')
        );
        this.editParentId.set(parentId);
        this.editChildSearch.set(this._categoryLabel(childId));
        this.selectedForm.reset({
            name: String(row['name'] ?? ''),
            unitId: String(row['unitId'] ?? ''),
            categoryId: childId,
            description: String(row['description'] ?? ''),
            imageUrl: String(row['imageUrl'] ?? ''),
            packingCodeId: String(row['packingCodeId'] ?? ''),
            vatRate: vatRateOf(row['vatRate']),
        });
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
