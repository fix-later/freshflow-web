import {
    ChangeDetectionStrategy,
    Component,
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
import { includesFolded } from 'app/core/util/text-search';
import { CrudOption, CrudRow } from '../shared/resource-crud.types';
import { TableSort } from '../shared/table-sort';
import { CatalogAdminService } from './catalog-admin.service';

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

    private _createDialogRef: MatDialogRef<unknown> | null = null;
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
    readonly pageSize = signal(10);
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

    /** All active categories (carry `parentId`) — feed the cascade selects. */
    readonly activeCategoryRows = signal<CrudRow[]>([]);
    /** Parent category chosen in the create / edit dialog. */
    readonly createParentId = signal('');
    readonly editParentId = signal('');
    /** In-dropdown search term for the sub-category select, per dialog. */
    readonly createChildSearch = signal('');
    readonly editChildSearch = signal('');

    /** Top-level active categories (no parent) — the "parent" dropdown. */
    readonly parentCategoryOptions = computed(() =>
        this.activeCategoryRows()
            .filter((c) => !String(c['parentId'] ?? '').trim())
            .map((c) => ({ value: c.id, label: String(c['name'] ?? '') }))
    );
    /** Active sub-categories of the parent chosen in each dialog. */
    readonly createChildOptions = computed(() =>
        this._childOptions(this.createParentId())
    );
    readonly editChildOptions = computed(() =>
        this._childOptions(this.editParentId())
    );
    /** Sub-categories of the parent chosen in the page filter. */
    readonly filterChildOptions = computed(() =>
        this._childOptions(this.filterParentId())
    );

    readonly selectedForm = new FormGroup({
        name: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        unitId: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        categoryId: new FormControl('', { nonNullable: true }),
        description: new FormControl('', { nonNullable: true }),
        imageUrl: new FormControl('', { nonNullable: true }),
    });

    readonly createForm = new FormGroup({
        name: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        unitId: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        categoryId: new FormControl('', { nonNullable: true }),
        description: new FormControl('', { nonNullable: true }),
    });

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
                page: this.pageIndex() + 1,
                pageSize: this.pageSize(),
                search: this.search().trim() || undefined,
                categoryId,
            })
            .then(({ rows, total, page, pageSize }) => {
                this.rows.set(rows);
                this.totalCount.set(total);
                // Track the page/size the backend actually returned.
                if (page) {
                    this.pageIndex.set(page - 1);
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
        });
    }

    openCreate(template: TemplateRef<unknown>): void {
        this.createForm.reset({
            name: '',
            unitId: '',
            categoryId: '',
            description: '',
        });
        this.createParentId.set('');
        this.createChildSearch.set('');
        this._createDialogRef = this._dialog.open(template, {
            width: '560px',
            maxWidth: '95vw',
            autoFocus: 'first-tabbable',
        });
    }

    closeCreate(): void {
        this._createDialogRef?.close();
        this._createDialogRef = null;
    }

    /** Pick a parent category → reset the sub-category so it re-filters. */
    onCreateParentChange(parentId: string): void {
        this.createParentId.set(parentId);
        this.createForm.controls.categoryId.setValue('');
    }

    onEditParentChange(parentId: string): void {
        this.editParentId.set(parentId);
        this.selectedForm.controls.categoryId.setValue('');
    }

    /** Type-to-search options for the sub-category autocomplete. */
    visibleChildOptions(mode: 'create' | 'edit'): CrudOption[] {
        const options =
            mode === 'create'
                ? this.createChildOptions()
                : this.editChildOptions();
        const term = (
            mode === 'create'
                ? this.createChildSearch()
                : this.editChildSearch()
        ).trim();
        const selectedId = this._childControl(mode).value;
        // Empty box, or still showing the current selection → full list.
        if (!term || term === this._categoryLabel(selectedId)) {
            return options;
        }
        return options.filter((opt) => includesFolded(opt.label, term));
    }

    onChildSearch(mode: 'create' | 'edit', term: string): void {
        (mode === 'create' ? this.createChildSearch : this.editChildSearch).set(
            term
        );
    }

    /** Pick a sub-category → store it, show its label, auto-fill the parent. */
    onChildSelected(mode: 'create' | 'edit', childId: string): void {
        this._childControl(mode).setValue(childId);
        (mode === 'create' ? this.createChildSearch : this.editChildSearch).set(
            this._categoryLabel(childId)
        );
        const parent = this._parentOf(childId);
        if (parent) {
            (mode === 'create' ? this.createParentId : this.editParentId).set(
                parent
            );
        }
    }

    /** On close, drop any unselected typed text — revert to the selection. */
    onChildBlur(mode: 'create' | 'edit'): void {
        const id = this._childControl(mode).value;
        (mode === 'create' ? this.createChildSearch : this.editChildSearch).set(
            id ? this._categoryLabel(id) : ''
        );
    }

    clearChild(mode: 'create' | 'edit'): void {
        this._childControl(mode).setValue('');
        (mode === 'create' ? this.createChildSearch : this.editChildSearch).set(
            ''
        );
    }

    /** Maps the stored category id → its name for the autocomplete display. */
    readonly childLabel = (id: string): string => this._categoryLabel(id);

    private _childControl(mode: 'create' | 'edit') {
        return mode === 'create'
            ? this.createForm.controls.categoryId
            : this.selectedForm.controls.categoryId;
    }

    private _categoryLabel(id: string): string {
        if (!id) {
            return '';
        }
        const cat = this.activeCategoryRows().find((c) => c.id === id);
        return cat ? String(cat['name'] ?? '') : '';
    }

    saveCreate(): void {
        if (this.createForm.invalid) {
            this.createForm.markAllAsTouched();
            return;
        }
        const value = this.createForm.getRawValue();
        this.saving.set(true);
        this._catalog
            .createProduct({
                ...value,
                categoryId: value.categoryId || this.createParentId(),
            })
            .then(() => {
                this._notify('admin.crud.createSuccess');
                this.closeCreate();
                this.load();
            })
            .catch((err) => void this._notifyError(err, 'admin.crud.saveError'))
            .finally(() => this.saving.set(false));
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
            const [units, activeCategories] = await Promise.all([
                this._catalog.unitOptions(),
                this._catalog.listCategories(true),
            ]);
            this.unitOptions.set(units);
            this.activeCategoryRows.set(activeCategories);
        } catch {
            this.unitOptions.set([]);
            this.activeCategoryRows.set([]);
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
