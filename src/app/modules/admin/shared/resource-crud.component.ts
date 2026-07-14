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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
    CrudField,
    CrudFormValue,
    CrudOption,
    CrudResource,
    CrudRow,
} from './resource-crud.types';

/**
 * Config-driven admin master-data screen: renders the list, a client-side
 * search, a create/edit dialog built from `resource.fields`, and remove/row
 * actions. One component backs every simple CRUD resource (categories, units,
 * products, hubs, vehicles, delivery zones) so they stay consistent.
 */
@Component({
    selector: 'admin-resource-crud',
    templateUrl: './resource-crud.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule,
        MatDialogModule,
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
export class ResourceCrudComponent implements OnInit {
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
    readonly editingId = signal<string | null>(null);
    /** Loaded options per select field name. */
    readonly selectOptions = signal<Record<string, CrudOption[]>>({});

    form: FormGroup | null = null;

    readonly filteredRows = computed(() => {
        const keys = this.resource.searchKeys;
        const term = this.search().trim().toLowerCase();
        if (!keys?.length || !term) {
            return this.rows();
        }
        return this.rows().filter((row) =>
            keys.some((key) =>
                String(row[key] ?? '')
                    .toLowerCase()
                    .includes(term)
            )
        );
    });

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.resource
            .list()
            .then((rows) => this.rows.set(rows))
            .catch(() => {
                this.rows.set([]);
                this._notify('admin.crud.loadError');
            })
            .finally(() => this.loading.set(false));
    }

    onSearch(value: string): void {
        this.search.set(value);
    }

    openCreate(): void {
        this.editingId.set(null);
        this.form = this._buildForm(null);
        void this._loadSelectOptions();
        this._open();
    }

    openEdit(row: CrudRow): void {
        this.editingId.set(row.id);
        this.form = this._buildForm(row);
        void this._loadSelectOptions();
        this._open();
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
        this.saving.set(true);
        const request = id
            ? this.resource.update(id, value)
            : this.resource.create(value);
        request
            .then(() => {
                this._notify(
                    id ? 'admin.crud.updateSuccess' : 'admin.crud.createSuccess'
                );
                this.closeDialog();
                this.load();
            })
            .catch(() => this._notify('admin.crud.saveError'))
            .finally(() => this.saving.set(false));
    }

    remove(row: CrudRow): void {
        const removeFn = this.resource.remove;
        if (!removeFn) {
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
                    this.load();
                })
                .catch(() => this._notify('admin.crud.saveError'));
        });
    }

    controlOf(name: string): FormControl {
        return this.form?.get(name) as FormControl;
    }

    private _open(): void {
        this._dialogRef = this._dialog.open(this._formDialog, {
            width: '30rem',
            maxWidth: 'calc(100vw - 2rem)',
            autoFocus: false,
        });
        this._dialogRef.afterClosed().subscribe(() => (this._dialogRef = null));
    }

    private _buildForm(row: CrudRow | null): FormGroup {
        const controls: Record<string, FormControl> = {};
        for (const field of this.resource.fields) {
            const value = row
                ? this._rowValue(row, field)
                : field.type === 'number'
                  ? null
                  : '';
            controls[field.name] = new FormControl(
                { value, disabled: !!row && !!field.createOnly },
                field.required ? [Validators.required] : []
            );
        }
        return new FormGroup(controls);
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

    private _notify(key: string): void {
        this._snackBar.open(this._transloco.translate(key), undefined, {
            duration: 3000,
        });
    }
}
