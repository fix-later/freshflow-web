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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { includesFolded } from 'app/core/util/text-search';
import { CrudOption, CrudRow } from '../shared/resource-crud.types';
import { CatalogAdminService } from './catalog-admin.service';

/** Admin ▸ Catalog ▸ Products ▸ New — full-page create form. */
@Component({
    selector: 'admin-product-create',
    templateUrl: './product-create.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        MatAutocompleteModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class ProductCreateComponent implements OnInit {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    readonly saving = signal(false);
    readonly optionsLoading = signal(false);
    readonly unitOptions = signal<CrudOption[]>([]);
    readonly unitSearch = signal('');
    readonly activeCategoryRows = signal<CrudRow[]>([]);
    readonly createParentId = signal('');
    readonly createChildSearch = signal('');

    /** Unit options filtered by the combobox's in-place search term. */
    readonly visibleUnitOptions = computed(() => {
        const term = this.unitSearch().trim();
        const options = this.unitOptions();
        if (!term) {
            return options;
        }
        return options.filter((opt) => includesFolded(opt.label, term));
    });

    readonly parentCategoryOptions = computed(() =>
        this.activeCategoryRows()
            .filter((c) => !String(c['parentId'] ?? '').trim())
            .map((c) => ({ value: c.id, label: String(c['name'] ?? '') }))
    );
    readonly createChildOptions = computed(() =>
        this._childOptions(this.createParentId())
    );

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

    ngOnInit(): void {
        void this._loadOptions();
    }

    goBack(): void {
        void this._router.navigate(['/admin/products']);
    }

    onUnitSearch(term: string): void {
        this.unitSearch.set(term);
    }

    onUnitSelected(unitId: string): void {
        this.createForm.controls.unitId.setValue(unitId);
        this.unitSearch.set(this._unitLabel(unitId));
    }

    onUnitBlur(): void {
        this.createForm.controls.unitId.markAsTouched();
        this.unitSearch.set(
            this._unitLabel(this.createForm.controls.unitId.value)
        );
    }

    clearUnit(): void {
        this.createForm.controls.unitId.setValue('');
        this.unitSearch.set('');
    }

    readonly unitLabel = (id: string): string => this._unitLabel(id);

    onCreateParentChange(parentId: string): void {
        this.createParentId.set(parentId);
        this.createForm.controls.categoryId.setValue('');
        this.createChildSearch.set('');
    }

    visibleChildOptions(): CrudOption[] {
        const term = this.createChildSearch().trim();
        const options = this.createChildOptions();
        if (!term) {
            return options;
        }
        return options.filter((opt) => includesFolded(opt.label, term));
    }

    onChildSearch(term: string): void {
        this.createChildSearch.set(term);
    }

    onChildSelected(childId: string): void {
        this.createForm.controls.categoryId.setValue(childId);
        this.createChildSearch.set(this._categoryLabel(childId));
        const parent = this._parentOf(childId);
        if (parent) {
            this.createParentId.set(parent);
        }
    }

    onChildBlur(): void {
        const id = this.createForm.controls.categoryId.value;
        this.createChildSearch.set(this._categoryLabel(id));
    }

    clearChild(): void {
        this.createForm.controls.categoryId.setValue('');
        this.createChildSearch.set('');
    }

    readonly childLabel = (id: string): string => this._categoryLabel(id);

    save(): void {
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
                this.goBack();
            })
            .catch((err) => void this._notifyError(err, 'admin.crud.saveError'))
            .finally(() => this.saving.set(false));
    }

    private async _loadOptions(): Promise<void> {
        this.optionsLoading.set(true);
        try {
            const [units, categories] = await Promise.all([
                this._catalog.listUnits(),
                this._catalog.listCategories(),
            ]);
            this.unitOptions.set(
                units.map((u) => ({
                    value: u.id,
                    label: String(u['name'] ?? u['abbreviation'] ?? u.id),
                }))
            );
            this.activeCategoryRows.set(
                categories.filter((c) => c.isActive !== false)
            );
        } catch {
            this.unitOptions.set([]);
            this.activeCategoryRows.set([]);
        } finally {
            this.optionsLoading.set(false);
        }
    }

    private _unitLabel(id: string): string {
        if (!id) {
            return '';
        }
        return this.unitOptions().find((opt) => opt.value === id)?.label ?? '';
    }

    private _childOptions(parentId: string): CrudOption[] {
        if (!parentId) {
            return [];
        }
        return this.activeCategoryRows()
            .filter((c) => String(c['parentId'] ?? '') === parentId)
            .map((c) => ({ value: c.id, label: String(c['name'] ?? '') }));
    }

    private _parentOf(childId: string): string {
        const cat = this.activeCategoryRows().find((c) => c.id === childId);
        return cat ? String(cat['parentId'] ?? '') : '';
    }

    private _categoryLabel(id: string): string {
        if (!id) {
            return '';
        }
        const cat = this.activeCategoryRows().find((c) => c.id === id);
        return cat ? String(cat['name'] ?? '') : '';
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
