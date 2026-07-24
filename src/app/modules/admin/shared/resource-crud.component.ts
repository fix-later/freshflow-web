import { NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    Input,
    OnInit,
    TemplateRef,
    ViewChild,
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
import { LocationPickerComponent } from 'app/core/maps/location-picker.component';
import { includesFolded } from 'app/core/util/text-search';
import { CoalescedTask } from './coalesced-task';
import {
    CrudField,
    CrudFilter,
    CrudFormValue,
    CrudOption,
    CrudResource,
    CrudRow,
} from './resource-crud.types';
import { TableSort } from './table-sort';

/**
 * Config-driven admin master-data screen in the markets inventory pattern:
 * searchable list, optional filters, expandable inline detail editor, and a
 * create dialog. One component backs categories, units, hubs, vehicles, and
 * delivery zones so they stay consistent with Quản lý chợ.
 */
@Component({
    selector: 'admin-resource-crud',
    templateUrl: './resource-crud.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    // The host sits between the routed wrapper (e.g. admin-hubs) and the page
    // content; make it a full-width flex block so the content stretches the
    // whole screen instead of shrinking to the default inline host width.
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        NgTemplateOutlet,
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
        LocationPickerComponent,
    ],
})
export class ResourceCrudComponent implements OnInit {
    /** Inventory-style row detail expand/collapse (Angular animate.enter/leave). */
    protected readonly expandOnEnter = expandOnEnter;
    protected readonly collapseOnLeave = collapseOnLeave;

    @Input({ required: true }) resource!: CrudResource;
    @ViewChild('formDialog') private _formDialog!: TemplateRef<unknown>;

    private readonly _dialog = inject(MatDialog);
    private readonly _confirmation = inject(FuseConfirmationService);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);

    private _dialogRef: MatDialogRef<unknown> | null = null;

    readonly rows = signal<CrudRow[]>([]);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly search = signal('');
    readonly pageIndex = signal(0);
    readonly pageSize = signal(10);
    /** Selected value per page-level filter (empty string = "all"). */
    readonly filterValues = signal<Record<string, string>>({});
    /** Loaded options per page-level filter name. */
    readonly filterOptions = signal<Record<string, CrudOption[]>>({});
    /** Expanded row id for the inline detail editor (null = closed). */
    readonly selectedId = signal<string | null>(null);
    readonly editingId = signal<string | null>(null);
    /** True while editing an existing row (see {@link save}). */
    readonly editing = signal(false);
    /** Inline save flash in the detail footer (markets pattern). */
    readonly flashMessage = signal<'success' | 'error' | null>(null);
    /** Loaded options per select field name. */
    readonly selectOptions = signal<Record<string, CrudOption[]>>({});
    /** In-dropdown filter term per `searchable` select field name. */
    readonly optionSearch = signal<Record<string, string>>({});
    /** Fields (by name) with an image upload currently in flight. */
    readonly uploading = signal<Record<string, boolean>>({});
    /** Fields (by name) whose dropzone is currently being dragged over. */
    readonly dragOver = signal<Record<string, boolean>>({});

    form: FormGroup | null = null;

    readonly filteredRows = computed(() => {
        const keys = this.resource.searchKeys;
        const term = this.search().trim();
        const values = this.filterValues();
        const activeFilters = (this.resource.filters ?? []).filter(
            (f) => values[f.name]
        );

        return this.rows().filter((row) => {
            const matchesSearch =
                !keys?.length ||
                !term ||
                keys.some((key) =>
                    includesFolded(String(row[key] ?? ''), term)
                );
            const matchesFilters = activeFilters.every((f) =>
                f.match(row, values[f.name])
            );
            return matchesSearch && matchesFilters;
        });
    });

    /** True when a search term or any page-level filter is currently applied. */
    readonly hasActiveFilters = computed(
        () =>
            this.search().trim() !== '' ||
            Object.values(this.filterValues()).some((v) => v)
    );

    /** Column sort state, applied after filtering and before pagination. */
    readonly sort = new TableSort<CrudRow>();

    /**
     * Sort key for the always-present status column. It has no `CrudColumn`, so
     * it needs a key that can't collide with a column's i18n label.
     */
    readonly STATUS_SORT_KEY = '__status__';

    /**
     * {@link filteredRows} in the active sort order.
     *
     * A column sorts on its `sortValue` when it declares one (numeric columns
     * need it — their `cell` is a formatted string like "500 kg"), otherwise on
     * the rendered `cell` text so what you sort by is what you see.
     */
    readonly sortedRows = computed(() =>
        this.sort.apply(this.filteredRows(), (row, key) => {
            if (key === this.STATUS_SORT_KEY) {
                // Matches the pill's own test: only an explicit false is inactive.
                return row.isActive !== false;
            }
            const column = this.resource.columns.find((c) => c.label === key);
            return column?.sortValue?.(row) ?? column?.cell(row) ?? '';
        })
    );

    /** The current page of {@link sortedRows}, clamped to a valid page. */
    readonly pagedRows = computed(() => {
        const rows = this.sortedRows();
        const size = this.pageSize();
        const start = this.pageIndex() * size;
        return rows.slice(start, start + size);
    });

    /**
     * `grid-template-columns` for the inventory-style list. Data columns (incl.
     * status) share width evenly; the trailing actions/details column stays
     * compact on the right edge.
     */
    get gridTemplateColumns(): string {
        const tracks: string[] = this.resource.columns.map((col) =>
            col.image ? '3rem' : 'minmax(0, 1fr)'
        );
        tracks.push('minmax(0, 1fr)'); // status
        if (this.usesInlineDetail && this.resource.rowActions?.length) {
            tracks.push('auto');
        }
        tracks.push('auto'); // details chevron or action buttons
        return tracks.join(' ');
    }

    /** Index of the first non-image column (emphasized as the primary label). */
    get nameColumnIndex(): number {
        return this.resource.columns.findIndex((col) => !col.image);
    }

    /**
     * Expandable inline editor (markets pattern). Disabled for compact
     * resources that use dialog edit + row action icons instead.
     */
    get usesInlineDetail(): boolean {
        return this.resource.inlineDetail !== false;
    }

    /**
     * Resources with several fields (hubs, markets, products) render the dialog
     * as a wider two-column grid; simple ones (categories, units) stay a narrow
     * single column.
     */
    get wideDialog(): boolean {
        return this.resource.fields.length >= 4;
    }

    /** Field layout without dialog top margin — used by the inline detail panel. */
    get fieldsLayoutClass(): string {
        return this.wideDialog
            ? 'grid w-full grid-cols-1 gap-3 sm:grid-cols-2'
            : 'flex w-full max-w-lg flex-col gap-3';
    }

    /** Field layout inside the dialog — fills the Fuse-sized shell. */
    get dialogFieldsLayoutClass(): string {
        return this.wideDialog
            ? 'grid w-full grid-cols-1 gap-3 sm:grid-cols-2'
            : 'flex w-full flex-col gap-3';
    }

    /**
     * Root classes for the create/edit dialog shell (Fuse compose / card
     * pattern): negative margin cancels Material dialog padding so the
     * primary header sits flush to the edges.
     */
    get dialogShellClass(): string {
        return this.wideDialog
            ? '-m-6 flex max-h-screen max-w-240 flex-col md:min-w-160 md:w-160'
            : '-m-6 flex max-h-screen flex-col md:min-w-120 md:w-120';
    }

    /** Fields that should span both columns (map + multi-line text). */
    fieldSpanClass(field: CrudField): string {
        return this.wideDialog &&
            (field.type === 'location' ||
                field.type === 'textarea' ||
                field.type === 'image')
            ? 'sm:col-span-2'
            : '';
    }

    ngOnInit(): void {
        this.load();
    }

    /**
     * Bound reference to {@link load}, handed to header actions so they can
     * refresh the table after changing data themselves.
     */
    readonly reload = (): void => this.load();

    /**
     * (Re)loads the table.
     *
     * Filter options are rebuilt from the rows just fetched, not just on init:
     * they are usually derived from the same data (the category filter lists
     * the categories that are a parent of something), so a create/edit/remove —
     * or a re-parent from the mind map — changes which options should exist.
     * Handing the rows over keeps this to a single GET per reload.
     */
    /** Refreshes the table; overlapping calls collapse into one request. */
    load(): void {
        this._loadTask.trigger();
    }

    private readonly _loadTask = new CoalescedTask(async () => {
        this.loading.set(true);
        try {
            await this._fetchRows();
        } catch (err) {
            this.rows.set([]);
            await this._notifyError(err, 'admin.crud.loadError');
        } finally {
            this.loading.set(false);
        }
    });

    /** Fetches and applies the rows, returning them so callers can inspect. */
    private async _fetchRows(): Promise<CrudRow[]> {
        const rows = await this.resource.list();
        this.rows.set(rows);
        await this._loadFilterOptions(rows);
        // Guard against sitting on a now-empty page after a deletion.
        if (this.pageIndex() * this.pageSize() >= rows.length) {
            this.pageIndex.set(0);
        }
        const id = this.selectedId();
        if (id) {
            const row = rows.find((r) => r.id === id);
            if (!row) {
                this.closeDetails();
            } else if (this.editing()) {
                this.form = this._buildForm(row);
            }
        }
        return rows;
    }

    /**
     * Restores a row, then checks the reload to confirm it actually took.
     *
     * `isActive` is not part of the documented update body, so the server may
     * accept the request and ignore the field — a 200 that changes nothing. The
     * row is re-read and a distinct message is shown when it comes back still
     * inactive, so the failure is visible instead of looking like success.
     */
    private async _runActivate(
        activateFn: (row: CrudRow) => Promise<void>,
        row: CrudRow
    ): Promise<void> {
        this.saving.set(true);
        try {
            await activateFn(row);
            const rows = await this._fetchRows();
            const updated = rows.find((r) => r.id === row.id);
            this._notify(
                updated?.isActive === false
                    ? 'admin.crud.reactivateIgnored'
                    : 'admin.crud.reactivateSuccess'
            );
        } catch (err) {
            await this._notifyError(err, 'admin.crud.saveError');
        } finally {
            this.saving.set(false);
        }
    }

    onSearch(value: string): void {
        this.search.set(value);
        this.pageIndex.set(0);
        this.closeDetails();
    }

    onFilterChange(filter: CrudFilter, value: string): void {
        this.filterValues.update((state) => ({
            ...state,
            [filter.name]: value,
        }));
        this.pageIndex.set(0);
        this.closeDetails();
    }

    /** Resets the search box and every page-level filter to "all". */
    clearFilters(): void {
        this.search.set('');
        this.filterValues.set({});
        this.pageIndex.set(0);
        this.closeDetails();
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
        this.closeDetails();
    }

    private async _loadFilterOptions(rows: CrudRow[]): Promise<void> {
        const filters = this.resource.filters ?? [];
        const entries = await Promise.all(
            filters.map(async (f) => {
                try {
                    return [f.name, await f.options(rows)] as const;
                } catch {
                    return [f.name, [] as CrudOption[]] as const;
                }
            })
        );
        this.filterOptions.set(Object.fromEntries(entries));

        // A selected value can vanish from the refreshed options (a category
        // stops being anyone's parent, say). Leaving it selected would filter
        // every row away with nothing in the UI explaining why, so fall back to
        // "all" for any filter whose selection no longer exists.
        this.filterValues.update((values) => {
            let changed = false;
            const next = { ...values };
            for (const [name, options] of entries) {
                const selected = next[name];
                if (selected && !options.some((o) => o.value === selected)) {
                    next[name] = '';
                    changed = true;
                }
            }
            return changed ? next : values;
        });
    }

    /** True when the row is explicitly inactive (matches markets/products pills). */
    isInactive(row: CrudRow): boolean {
        return row.isActive === false;
    }

    toggleDetails(row: CrudRow): void {
        if (this.selectedId() === row.id) {
            this.closeDetails();
            return;
        }
        this.closeDialog();
        this.selectedId.set(row.id);
        this.editing.set(true);
        this.editingId.set(row.id);
        this.flashMessage.set(null);
        this.form = this._buildForm(row);
        this.optionSearch.set({});
        void this._loadSelectOptions();
    }

    closeDetails(): void {
        if (!this.selectedId()) {
            return;
        }
        this.selectedId.set(null);
        this.editing.set(false);
        this.editingId.set(null);
        this.flashMessage.set(null);
        // Keep create-dialog form intact when only closing details.
        if (!this._dialogRef) {
            this.form = null;
        }
    }

    openCreate(): void {
        this.closeDetails();
        this.editing.set(false);
        this.editingId.set(null);
        this.form = this._buildForm(null);
        this.optionSearch.set({});
        void this._loadSelectOptions();
        this._open();
    }

    /**
     * Opens a row for editing — inline detail panel when
     * {@link usesInlineDetail}, otherwise the create/edit dialog.
     */
    openEdit(row: CrudRow): void {
        this.closeDialog();
        this.editing.set(true);
        this.editingId.set(row.id);
        this.flashMessage.set(null);
        this.form = this._buildForm(row);
        this.optionSearch.set({});
        void this._loadSelectOptions();

        if (this.usesInlineDetail) {
            this.selectedId.set(row.id);
        } else {
            this.selectedId.set(null);
            this._open();
        }
    }

    closeDialog(): void {
        this._dialogRef?.close();
    }

    save(): void {
        if (!this.form || this.form.invalid) {
            this.form?.markAllAsTouched();
            return;
        }
        const value = this._payload();
        const id = this.editingId();
        const inline =
            this.usesInlineDetail && !!this.selectedId() && this.editing();

        // Whether this is an edit is tracked separately from the id, because a
        // row whose id the API named something unexpected yields a blank id —
        // and falling through to `create` would silently add a duplicate
        // instead of saving the change. Refuse rather than write the wrong row.
        if (this.editing() && !id) {
            this._notify('admin.crud.missingIdError');
            return;
        }

        this.saving.set(true);
        const request = id
            ? this.resource.update(id, value)
            : this.resource.create(value);
        request
            .then(() => {
                if (id) {
                    if (inline) {
                        this.showFlashMessage('success');
                    } else {
                        this._notify('admin.crud.updateSuccess');
                        this.closeDialog();
                    }
                } else {
                    this._notify('admin.crud.createSuccess');
                    this.closeDialog();
                }
                this.load();
            })
            .catch((err) => {
                if (inline) {
                    this.showFlashMessage('error');
                }
                void this._notifyError(err, 'admin.crud.saveError');
            })
            .finally(() => this.saving.set(false));
    }

    showFlashMessage(type: 'success' | 'error'): void {
        this.flashMessage.set(type);
        window.setTimeout(() => {
            if (this.flashMessage() === type) {
                this.flashMessage.set(null);
            }
        }, 3000);
    }

    /** Deactivate / delete / reactivate the expanded row from the detail footer. */
    removeSelected(): void {
        const id = this.selectedId();
        if (!id) {
            return;
        }
        const row = this.rows().find((r) => r.id === id);
        if (row) {
            this.remove(row);
        }
    }

    selectedRow(): CrudRow | undefined {
        const id = this.selectedId();
        return id ? this.rows().find((r) => r.id === id) : undefined;
    }

    /**
     * True when the row's action is a deactivate and the row is already
     * inactive, leaving nothing for the button to do.
     *
     * Deactivation is one-way. Probing the live API returns 404 for
     * `PATCH /{resource}/{id}/activate` and `/reactivate` on categories, units,
     * products and markets, while `/deactivate` returns 401 (route exists, auth
     * missing) — and no update request body carries an `isActive` field. With no
     * endpoint for the reverse direction the button is disabled and explains
     * itself, rather than firing a call that cannot change anything.
     */
    isAlreadyInactive(row: CrudRow): boolean {
        return !!this.resource.removeIsDeactivate && row.isActive === false;
    }

    /** True when the row action should restore the row rather than remove it. */
    isReactivate(row: CrudRow): boolean {
        return this.isAlreadyInactive(row) && !!this.resource.activate;
    }

    /** Icon for the row action, per the direction it would move the row. */
    removeIconFor(row: CrudRow): string {
        return this.isReactivate(row)
            ? 'archive-box-arrow-down'
            : this.resource.removeIcon ?? 'trash';
    }

    /** Visible label for the detail-footer remove/deactivate/reactivate button. */
    removeLabelFor(row: CrudRow): string {
        if (this.isReactivate(row)) {
            return 'admin.crud.reactivate';
        }
        return this.resource.removeLabel ?? 'admin.crud.remove';
    }

    /** Tooltip for the remove action, per its direction and availability. */
    removeTooltipFor(row: CrudRow): string {
        if (this.isReactivate(row)) {
            return 'admin.crud.reactivate';
        }
        if (this.isAlreadyInactive(row)) {
            return 'admin.crud.alreadyInactive';
        }
        return this.resource.removeLabel ?? 'admin.crud.remove';
    }

    remove(row: CrudRow): void {
        const activateFn = this.resource.activate;
        // Restoring is non-destructive and undone by the same button, so it
        // skips the confirmation that deactivate and delete keep.
        if (this.isReactivate(row) && activateFn) {
            void this._runActivate(activateFn, row);
            return;
        }

        const removeFn = this.resource.remove;
        if (!removeFn || this.isAlreadyInactive(row)) {
            return;
        }
        const ref = this._confirmation.open({
            title: this._transloco.translate('admin.crud.confirmRemove.title'),
            message: this._transloco.translate(
                'admin.crud.confirmRemove.message'
            ),
            actions: {
                confirm: {
                    label: this._transloco.translate(
                        this.resource.removeLabel ?? 'admin.crud.remove'
                    ),
                    color: 'warn',
                },
            },
        });
        ref.afterClosed().subscribe((result) => {
            if (result !== 'confirmed') {
                return;
            }
            removeFn(row)
                .then(() => {
                    this._notify('admin.crud.removeSuccess');
                    if (this.selectedId() === row.id) {
                        this.closeDetails();
                    }
                    this.load();
                })
                .catch((err) => this._notifyError(err, 'admin.crud.saveError'));
        });
    }

    controlOf(name: string): FormControl {
        return this.form?.get(name) as FormControl;
    }

    /**
     * Moves focus into a searchable select's filter box once its panel opens.
     *
     * `mat-select` focuses the panel itself on open, so without this the user
     * would have to click the box before typing. The input lives inside the
     * panel (an embedded view created on open), so it can't be reached with a
     * template ref from here — it's queried from the open overlay instead, on a
     * macrotask so the panel has been attached to the DOM.
     */
    focusOptionSearch(): void {
        setTimeout(() =>
            document
                .querySelector<HTMLInputElement>(
                    '.mat-mdc-select-panel .admin-option-search'
                )
                ?.focus()
        );
    }

    onOptionSearch(field: CrudField, term: string): void {
        this.optionSearch.update((state) => ({
            ...state,
            [field.name]: term,
        }));
    }

    /**
     * Options to render for a select, narrowed by its in-dropdown filter.
     *
     * The currently selected option is always kept in the list even when it
     * doesn't match the term — `mat-select` renders its trigger label from the
     * options present, so dropping it would blank out the field's display.
     */
    visibleOptions(field: CrudField): CrudOption[] {
        const options = this.selectOptions()[field.name] ?? [];
        const term = this.optionSearch()[field.name] ?? '';
        if (!field.searchable || !term.trim()) {
            return options;
        }
        const selected = this.controlOf(field.name)?.value;
        return options.filter(
            (opt) => opt.value === selected || includesFolded(opt.label, term)
        );
    }

    /** True while any image upload is still in flight (blocks saving). */
    get anyUploading(): boolean {
        return Object.values(this.uploading()).some(Boolean);
    }

    /** Whether a field is shown for the current create/edit mode. */
    isFieldVisible(field: CrudField): boolean {
        const editing = this.editing();
        if (editing && field.createOnly) {
            return false;
        }
        if (!editing && field.editOnly) {
            return false;
        }
        return true;
    }

    /** Handles an image file picked via the file dialog for an `image` field. */
    onImagePicked(field: CrudField, input: HTMLInputElement): void {
        const file = input.files?.[0];
        input.value = '';
        this._uploadImage(field, file);
    }

    /** Handles an image dropped onto the field's dropzone. */
    onImageDropped(field: CrudField, event: DragEvent): void {
        event.preventDefault();
        this._setDragOver(field.name, false);
        if (this.uploading()[field.name]) {
            return;
        }
        this._uploadImage(field, event.dataTransfer?.files?.[0]);
    }

    /** Toggles the drag-over highlight for a dropzone. */
    onDragOver(field: CrudField, event: DragEvent): void {
        event.preventDefault();
        this._setDragOver(field.name, true);
    }

    onDragLeave(field: CrudField): void {
        this._setDragOver(field.name, false);
    }

    /** Clears the stored image URL for an `image` field. */
    clearImage(field: CrudField): void {
        this.controlOf(field.name)?.setValue('');
    }

    private _uploadImage(field: CrudField, file: File | undefined): void {
        if (!file || !field.upload) {
            return;
        }
        if (!file.type.startsWith('image/')) {
            this._notify('admin.crud.image.invalidType');
            return;
        }
        this._setUploading(field.name, true);
        field
            .upload(file)
            .then((url) => this.controlOf(field.name)?.setValue(url))
            .catch((err) =>
                this._notifyError(err, 'admin.crud.image.uploadError')
            )
            .finally(() => this._setUploading(field.name, false));
    }

    private _setUploading(name: string, value: boolean): void {
        this.uploading.update((state) => ({ ...state, [name]: value }));
    }

    private _setDragOver(name: string, value: boolean): void {
        this.dragOver.update((state) => ({ ...state, [name]: value }));
    }

    private _open(): void {
        // Size comes from Tailwind on the dialog content (Fuse compose pattern),
        // not MatDialog width — keeps the primary header flush to the edges.
        this._dialogRef = this._dialog.open(this._formDialog, {
            autoFocus: false,
            maxWidth: '100vw',
        });
        this._dialogRef.afterClosed().subscribe(() => (this._dialogRef = null));
    }

    private _buildForm(row: CrudRow | null): FormGroup {
        const controls: Record<string, FormControl> = {};
        for (const field of this.resource.fields) {
            if (field.type === 'location') {
                for (const coord of [field.latField, field.lngField]) {
                    if (coord) {
                        controls[coord] = new FormControl(
                            row ? this._coordValue(row, coord) : null
                        );
                    }
                }
                continue;
            }
            const value = row
                ? this._rowValue(row, field)
                : field.type === 'number'
                  ? null
                  : '';
            controls[field.name] = new FormControl(
                { value, disabled: !!row && !!field.createOnly },
                this._validatorsFor(field)
            );
        }
        return new FormGroup(controls);
    }

    private _validatorsFor(field: CrudField) {
        const validators = [];
        if (field.required) {
            validators.push(Validators.required);
        }
        if (field.maxLength != null) {
            validators.push(Validators.maxLength(field.maxLength));
        }
        if (field.min != null) {
            validators.push(Validators.min(field.min));
        }
        return validators;
    }

    private _coordValue(row: CrudRow, key: string): number | null {
        const raw = row[key];
        if (raw == null || raw === '') {
            return null;
        }
        const num = Number(raw);
        return Number.isNaN(num) ? null : num;
    }

    private async _loadSelectOptions(): Promise<void> {
        const loaders = this.resource.fields.filter(
            (f) => f.type === 'select' && f.options
        );
        const entries = await Promise.all(
            loaders.map(async (f) => {
                try {
                    return [f.name, await f.options!()] as const;
                } catch {
                    return [f.name, [] as CrudOption[]] as const;
                }
            })
        );
        this.selectOptions.set(Object.fromEntries(entries));
    }

    private _rowValue(row: CrudRow, field: CrudField): string | number | null {
        const raw = row[field.name];
        if (raw == null) {
            return field.type === 'number' ? null : '';
        }
        if (field.type === 'number') {
            return typeof raw === 'number' ? raw : Number(raw);
        }
        return String(raw);
    }

    private _payload(): CrudFormValue {
        const raw = this.form?.getRawValue() as Record<string, unknown>;
        const out: CrudFormValue = {};
        for (const field of this.resource.fields) {
            if (field.type === 'location') {
                for (const coord of [field.latField, field.lngField]) {
                    if (coord) {
                        out[coord] = this._toNumberOrNull(raw[coord]);
                    }
                }
                continue;
            }
            const value = raw[field.name];
            if (field.type === 'number') {
                const num = Number(value);
                out[field.name] =
                    value === '' || value == null || Number.isNaN(num)
                        ? null
                        : num;
            } else {
                const str = (value ?? '').toString().trim();
                out[field.name] =
                    str === '' ? (field.required ? '' : null) : str;
            }
        }
        return out;
    }

    private _toNumberOrNull(value: unknown): number | null {
        if (value === '' || value == null) {
            return null;
        }
        const num = Number(value);
        return Number.isNaN(num) ? null : num;
    }

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }

    /**
     * Shows the backend's rejection reason when it sent one (permission denied,
     * validation, conflict…), falling back to a translated generic message when
     * it didn't. Errors linger longer than successes so the reason can be read.
     */
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
