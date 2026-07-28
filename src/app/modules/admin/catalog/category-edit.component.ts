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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { includesFolded } from 'app/core/util/text-search';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { CrudOption, CrudRow } from '../shared/resource-crud.types';
import { CatalogAdminService } from './catalog-admin.service';

const META_FIELDS: { key: string; label: string; kind?: 'date' }[] = [
    { key: 'id', label: 'admin.crud.id' },
    { key: 'parentName', label: 'admin.categories.parent' },
    { key: 'createdAt', label: 'admin.crud.createdAt', kind: 'date' },
    { key: 'updatedAt', label: 'admin.crud.updatedAt', kind: 'date' },
];

/**
 * Admin ▸ Catalog ▸ Categories ▸ Edit — full-page editor (hub/market pattern).
 */
@Component({
    selector: 'admin-category-edit',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatAutocompleteModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
    templateUrl: './category-edit.component.html',
})
export class CategoryEditComponent implements OnInit {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _confirmation = inject(FuseConfirmationService);

    readonly category = signal<CrudRow | null>(null);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly notFound = signal(false);
    readonly parentOptions = signal<CrudOption[]>([]);
    readonly parentSearch = signal('');

    readonly categoryName = computed(() =>
        String(this.category()?.['name'] ?? '')
    );
    readonly isActive = computed(() => this.category()?.isActive !== false);

    readonly metaEntries = computed(() => {
        const row = this.category();
        if (!row) {
            return [];
        }
        return META_FIELDS.map(({ key, label, kind }) => ({
            label,
            value: this._formatMeta(row[key], kind),
        })).filter((e) => e.value !== '');
    });

    /** Parent options excluding self; filtered by {@link parentSearch}. */
    readonly visibleParentOptions = computed(() => {
        const selfId = this.category()?.id ?? '';
        const options = this.parentOptions().filter((o) => o.value !== selfId);
        const term = this.parentSearch().trim();
        if (!term) {
            return options;
        }
        if (options.some((opt) => opt.label === term)) {
            return options;
        }
        return options.filter((opt) => includesFolded(opt.label, term));
    });

    readonly form = new FormGroup({
        name: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        parentId: new FormControl('', { nonNullable: true }),
    });

    ngOnInit(): void {
        void this._catalog
            .categoryOptions(true)
            .then((opts) => this.parentOptions.set(opts));

        const id = this._route.snapshot.paramMap.get('categoryId') ?? '';
        const passed = (history.state?.category ?? null) as CrudRow | null;
        if (passed && passed.id === id) {
            this._apply(passed);
            this._fetch(id, /* keepVisible */ true);
            return;
        }
        if (id) {
            this._fetch(id);
            return;
        }
        this.notFound.set(true);
    }

    goBack(): void {
        void this._router.navigate(['/admin/categories']);
    }

    parentLabel = (id: string | null): string => {
        if (!id) {
            return '';
        }
        return this.parentOptions().find((o) => o.value === id)?.label ?? '';
    };

    onParentSearch(term: string): void {
        this.parentSearch.set(term);
        if (term !== this.parentLabel(this.form.controls.parentId.value)) {
            this.form.controls.parentId.setValue('');
        }
    }

    onParentSelected(parentId: string): void {
        this.form.controls.parentId.setValue(parentId);
        this.parentSearch.set(this.parentLabel(parentId));
    }

    onParentBlur(): void {
        const id = this.form.controls.parentId.value;
        this.parentSearch.set(id ? this.parentLabel(id) : '');
    }

    clearParent(): void {
        this.form.controls.parentId.setValue('');
        this.parentSearch.set('');
    }

    save(): void {
        const row = this.category();
        if (!row || this.form.invalid || this.saving()) {
            this.form.markAllAsTouched();
            return;
        }
        this.saving.set(true);
        const value = this.form.getRawValue();
        void this._catalog
            .updateCategory(row.id, {
                name: value.name,
                parentId: value.parentId || null,
            })
            .then(() => {
                this._notify('admin.crud.updateSuccess');
                this.goBack();
            })
            .catch((err) => void this._notifyError(err, 'admin.crud.saveError'))
            .finally(() => this.saving.set(false));
    }

    deactivate(): void {
        const row = this.category();
        if (!row || this.saving() || !this.isActive()) {
            return;
        }
        const ref = this._confirmation.open({
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
        ref.afterClosed().subscribe((result) => {
            if (result !== 'confirmed') {
                return;
            }
            this.saving.set(true);
            void this._catalog
                .deactivateCategory(row.id)
                .then(() => {
                    this._notify('admin.crud.removeSuccess');
                    this.goBack();
                })
                .catch(
                    (err) => void this._notifyError(err, 'admin.crud.saveError')
                )
                .finally(() => this.saving.set(false));
        });
    }

    reactivate(): void {
        const row = this.category();
        if (!row || this.saving() || this.isActive()) {
            return;
        }
        this.saving.set(true);
        void this._catalog
            .activateCategory(row)
            .then(() => {
                this._notify('admin.crud.reactivateSuccess');
                this._fetch(row.id, true);
            })
            .catch((err) => void this._notifyError(err, 'admin.crud.saveError'))
            .finally(() => this.saving.set(false));
    }

    private _fetch(id: string, keepVisible = false): void {
        if (!keepVisible) {
            this.loading.set(true);
        }
        void this._catalog
            .getCategory(id)
            .then((row) => {
                if (row) {
                    this._apply(row);
                } else if (!keepVisible) {
                    this.notFound.set(true);
                }
            })
            .catch(() => {
                if (!keepVisible) {
                    this.notFound.set(true);
                }
            })
            .finally(() => this.loading.set(false));
    }

    private _apply(row: CrudRow): void {
        this.category.set(row);
        this.notFound.set(false);
        const parentId =
            row['parentId'] == null || row['parentId'] === ''
                ? ''
                : String(row['parentId']);
        this.form.reset({
            name: String(row['name'] ?? ''),
            parentId,
        });
        this.parentSearch.set(
            String(row['parentName'] ?? '') || this.parentLabel(parentId)
        );
    }

    private _formatMeta(value: unknown, kind?: 'date'): string {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        if (kind === 'date') {
            const date = new Date(String(value));
            return Number.isNaN(date.getTime())
                ? ''
                : date.toLocaleString(this._transloco.getActiveLang());
        }
        return String(value);
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
        this._snackBar.open(message, undefined, { duration: 6000 });
    }
}
