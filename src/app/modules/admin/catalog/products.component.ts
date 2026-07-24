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
import { collapseOnLeave, expandOnEnter } from '@fuse/animations';
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
                /* image | name | details — matches cells visible below sm */
                grid-template-columns: 3rem minmax(0, 1fr) auto;

                @screen sm {
                    /* image | name | category | details */
                    grid-template-columns: 3rem minmax(0, 1.5fr) minmax(0, 1fr) auto;
                }

                @screen md {
                    /* image | name | category | unit | details */
                    grid-template-columns:
                        3rem minmax(0, 1.5fr) minmax(0, 1fr) minmax(5rem, 0.7fr)
                        auto;
                }
            }
        `,
    ],
})
export class ProductsComponent implements OnInit {
    protected readonly expandOnEnter = expandOnEnter;
    protected readonly collapseOnLeave = collapseOnLeave;

    private readonly _catalog = inject(CatalogAdminService);
    private readonly _dialog = inject(MatDialog);
    private readonly _confirmation = inject(FuseConfirmationService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    private _createDialogRef: MatDialogRef<unknown> | null = null;

    readonly rows = signal<CrudRow[]>([]);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly uploading = signal(false);
    readonly dragOver = signal(false);
    readonly search = signal('');
    readonly categoryFilter = signal('');
    readonly statusFilter = signal('');
    readonly pageIndex = signal(0);
    readonly pageSize = signal(10);
    readonly selectedId = signal<string | null>(null);
    readonly flashMessage = signal<'success' | 'error' | null>(null);
    readonly sort = new TableSort<CrudRow>();
    readonly categoryOptions = signal<CrudOption[]>([]);
    readonly unitOptions = signal<CrudOption[]>([]);
    /** Active categories only — for the page filter dropdown. */
    readonly filterCategoryOptions = signal<CrudOption[]>([]);

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

    readonly filteredRows = computed(() => {
        const term = this.search().trim();
        const categoryId = this.categoryFilter();
        const status = this.statusFilter();

        return this.rows().filter((row) => {
            const matchesSearch =
                !term || includesFolded(String(row['name'] ?? ''), term);
            const matchesCategory =
                !categoryId || String(row['categoryId'] ?? '') === categoryId;
            const matchesStatus =
                !status ||
                (status === 'active'
                    ? row.isActive !== false
                    : row.isActive === false);
            return matchesSearch && matchesCategory && matchesStatus;
        });
    });

    readonly sortedRows = computed(() =>
        this.sort.apply(this.filteredRows(), (row, key) => {
            if (key === 'category') {
                return String(row['categoryName'] ?? '');
            }
            if (key === 'unit') {
                return String(row['unitName'] ?? row['unitAbbreviation'] ?? '');
            }
            return String(row[key] ?? '');
        })
    );

    readonly pagedRows = computed(() => {
        const start = this.pageIndex() * this.pageSize();
        return this.sortedRows().slice(start, start + this.pageSize());
    });

    readonly hasActiveFilters = computed(
        () =>
            this.search().trim() !== '' ||
            this.categoryFilter() !== '' ||
            this.statusFilter() !== ''
    );

    ngOnInit(): void {
        this.load();
        void this._loadOptions();
    }

    load(): void {
        this.loading.set(true);
        this._catalog
            .listProducts()
            .then((rows) => {
                this.rows.set(rows);
                const id = this.selectedId();
                if (id && !rows.some((r) => r.id === id)) {
                    this.closeDetails();
                } else if (id) {
                    const row = rows.find((r) => r.id === id);
                    if (row) {
                        this._patchSelected(row);
                    }
                }
            })
            .catch((err) => void this._notifyError(err, 'admin.crud.loadError'))
            .finally(() => this.loading.set(false));
    }

    onSearch(value: string): void {
        this.search.set(value);
        this.pageIndex.set(0);
        this.closeDetails();
    }

    onCategoryFilter(value: string): void {
        this.categoryFilter.set(value);
        this.pageIndex.set(0);
        this.closeDetails();
    }

    onStatusFilter(value: string): void {
        this.statusFilter.set(value);
        this.pageIndex.set(0);
        this.closeDetails();
    }

    clearFilters(): void {
        this.search.set('');
        this.categoryFilter.set('');
        this.statusFilter.set('');
        this.pageIndex.set(0);
        this.closeDetails();
    }

    onSort(key: string): void {
        this.sort.toggle(key);
        this.pageIndex.set(0);
        this.closeDetails();
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
        this.closeDetails();
    }

    toggleDetails(row: CrudRow): void {
        if (this.selectedId() === row.id) {
            this.closeDetails();
            return;
        }
        this.selectedId.set(row.id);
        this.flashMessage.set(null);
        this._patchSelected(row);
    }

    closeDetails(): void {
        this.selectedId.set(null);
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

    saveCreate(): void {
        if (this.createForm.invalid) {
            this.createForm.markAllAsTouched();
            return;
        }
        this.saving.set(true);
        this._catalog
            .createProduct(this.createForm.getRawValue())
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
        this.saving.set(true);
        this._catalog
            .updateProduct(id, this.selectedForm.getRawValue())
            .then(() => {
                this.showFlashMessage('success');
                this.load();
            })
            .catch((err) => {
                this.showFlashMessage('error');
                void this._notifyError(err, 'admin.crud.saveError');
            })
            .finally(() => this.saving.set(false));
    }

    deactivateSelected(): void {
        const id = this.selectedId();
        if (!id) {
            return;
        }
        const row = this.rows().find((r) => r.id === id);
        if (row?.isActive === false) {
            return;
        }

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
        return row.isActive === false;
    }

    unitLabel(row: CrudRow): string {
        return String(row['unitName'] ?? row['unitAbbreviation'] ?? '');
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
            const [units, categories, filterCategories] = await Promise.all([
                this._catalog.unitOptions(),
                this._catalog.categoryOptions(),
                this._catalog.categoryOptions(true),
            ]);
            this.unitOptions.set(units);
            this.categoryOptions.set(categories);
            this.filterCategoryOptions.set(filterCategories);
        } catch {
            this.unitOptions.set([]);
            this.categoryOptions.set([]);
            this.filterCategoryOptions.set([]);
        }
    }

    private _patchSelected(row: CrudRow): void {
        this.selectedForm.reset({
            name: String(row['name'] ?? ''),
            unitId: String(row['unitId'] ?? ''),
            categoryId: String(row['categoryId'] ?? ''),
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
