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
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import { LocationPickerComponent } from 'app/core/maps/location-picker.component';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { CrudOption, CrudRow } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';

/** Read-only meta keys shown in the hub detail grid (API HubDto fields). */
const META_FIELDS: {
    key: string;
    label: string;
    kind?: 'date' | 'kg' | '%';
}[] = [
    { key: 'id', label: 'admin.crud.id' },
    {
        key: 'occupiedCapacityKg',
        label: 'admin.hubs.occupiedCapacityKg',
        kind: 'kg',
    },
    {
        key: 'availableCapacityKg',
        label: 'admin.hubs.availableCapacityKg',
        kind: 'kg',
    },
    {
        key: 'utilizationPercent',
        label: 'admin.hubs.utilizationPercent',
        kind: '%',
    },
    { key: 'createdAt', label: 'admin.crud.createdAt', kind: 'date' },
    { key: 'updatedAt', label: 'admin.crud.updatedAt', kind: 'date' },
];

/**
 * Admin ▸ Logistics ▸ Hubs ▸ Edit — full-page editor (map + fields) reached
 * from the hubs list so the list stays scannable (SCREEN_RULES: long forms
 * as routed pages).
 */
@Component({
    selector: 'admin-hub-edit',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: { class: 'flex flex-auto flex-col' },
    imports: [
        AdminLoadingStateComponent,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
        LocationPickerComponent,
    ],
    templateUrl: './hub-edit.component.html',
})
export class HubEditComponent implements OnInit {
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _confirmation = inject(FuseConfirmationService);

    readonly hub = signal<CrudRow | null>(null);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly notFound = signal(false);
    readonly managerOptions = signal<CrudOption[]>([]);
    readonly marketOptions = signal<CrudOption[]>([]);
    readonly hubName = computed(() => String(this.hub()?.['name'] ?? ''));
    readonly isActive = computed(() => this.hub()?.isActive !== false);

    /** M8 Hub management (admin = Full): who currently works this hub. */
    readonly staffOptions = signal<CrudOption[]>([]);
    readonly assignedStaffIds = signal<Set<string>>(new Set());
    readonly loadingStaff = signal(false);
    readonly savingStaff = signal(false);

    /** M8 Hub inbound/discrepancy oversight (admin = read-only, ROLE_MATRIX). */
    readonly pendingInbound = signal<CrudRow[]>([]);
    readonly openDiscrepancies = signal<CrudRow[]>([]);
    readonly loadingOversight = signal(false);

    /** Read-only HubDto fields for the detail grid. */
    readonly metaEntries = computed(() => {
        const row = this.hub();
        if (!row) {
            return [];
        }
        return META_FIELDS.map(({ key, label, kind }) => ({
            label,
            value: this._formatMeta(row[key], kind),
        })).filter((e) => e.value !== '');
    });

    readonly form = new FormGroup({
        marketId: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        name: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required, Validators.maxLength(200)],
        }),
        capacityKg: new FormControl<number | null>(null, {
            validators: [Validators.required, Validators.min(1)],
        }),
        managedBy: new FormControl('', { nonNullable: true }),
        address: new FormControl('', { nonNullable: true }),
        latitude: new FormControl<number | null>(null),
        longitude: new FormControl<number | null>(null),
    });

    ngOnInit(): void {
        void this._logistics
            .hubManagerOptions()
            .then((opts) => this.managerOptions.set(opts));
        void this._logistics
            .hubManagerOptions()
            .then((opts) => this.staffOptions.set(opts));
        void this._logistics
            .marketOptions()
            .then((opts) => this.marketOptions.set(opts));

        const id = this._route.snapshot.paramMap.get('hubId') ?? '';
        const passed = (history.state?.hub ?? null) as CrudRow | null;
        if (passed && passed.id === id) {
            this._apply(passed);
            // Refresh so capacity utilization / timestamps stay current.
            this._fetch(id, /* keepVisible */ true);
            this._loadStaff(id);
            this._loadOversight(id);
            return;
        }
        if (id) {
            this._fetch(id);
            this._loadStaff(id);
            this._loadOversight(id);
            return;
        }
        this.notFound.set(true);
    }

    goBack(): void {
        void this._router.navigate(['/admin/hubs']);
    }

    save(): void {
        const row = this.hub();
        if (!row || this.form.invalid || this.saving()) {
            this.form.markAllAsTouched();
            return;
        }
        this.saving.set(true);
        const value = this.form.getRawValue();
        void this._logistics
            .updateHub(row.id, {
                marketId: value.marketId,
                name: value.name,
                capacityKg: value.capacityKg,
                address: value.address || null,
                latitude: value.latitude,
                longitude: value.longitude,
                managedBy: value.managedBy || null,
            })
            .then(() => {
                this._notify('admin.crud.updateSuccess');
                this.goBack();
            })
            .catch((err) => void this._notifyError(err, 'admin.crud.saveError'))
            .finally(() => this.saving.set(false));
    }

    remove(): void {
        const row = this.hub();
        if (!row || this.saving()) {
            return;
        }
        const ref = this._confirmation.open({
            title: this._transloco.translate('admin.crud.confirmRemove.title'),
            message: this._transloco.translate(
                'admin.crud.confirmRemove.message'
            ),
            actions: {
                confirm: {
                    label: this._transloco.translate('admin.crud.delete'),
                    color: 'warn',
                },
            },
        });
        ref.afterClosed().subscribe((result) => {
            if (result !== 'confirmed') {
                return;
            }
            this.saving.set(true);
            void this._logistics
                .deleteHub(row.id)
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

    isStaffAssigned(userId: string): boolean {
        return this.assignedStaffIds().has(userId);
    }

    toggleStaff(userId: string, checked: boolean): void {
        const next = new Set(this.assignedStaffIds());
        if (checked) {
            next.add(userId);
        } else {
            next.delete(userId);
        }
        this.assignedStaffIds.set(next);
    }

    saveStaffAssignments(): void {
        const row = this.hub();
        if (!row || this.savingStaff()) {
            return;
        }
        this.savingStaff.set(true);
        void this._logistics
            .replaceHubStaffAssignments(row.id, [...this.assignedStaffIds()])
            .then(() => this._notify('admin.hubs.staff.success'))
            .catch((err) => void this._notifyError(err, 'admin.crud.saveError'))
            .finally(() => this.savingStaff.set(false));
    }

    private _loadStaff(hubId: string): void {
        this.loadingStaff.set(true);
        void this._logistics
            .getHubStaffAssignments(hubId)
            .then((ids) => this.assignedStaffIds.set(new Set(ids)))
            .catch(() => this.assignedStaffIds.set(new Set()))
            .finally(() => this.loadingStaff.set(false));
    }

    private _loadOversight(hubId: string): void {
        this.loadingOversight.set(true);
        Promise.all([
            this._logistics.getPendingInbound(hubId),
            this._logistics.getDiscrepancies(hubId, 'open'),
        ])
            .then(([pending, discrepancies]) => {
                this.pendingInbound.set(pending);
                this.openDiscrepancies.set(discrepancies);
            })
            .catch(() => {
                this.pendingInbound.set([]);
                this.openDiscrepancies.set([]);
            })
            .finally(() => this.loadingOversight.set(false));
    }

    private _fetch(id: string, keepVisible = false): void {
        if (!keepVisible) {
            this.loading.set(true);
        }
        void this._logistics
            .getHub(id)
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
        this.hub.set(row);
        this.notFound.set(false);
        this.form.reset({
            marketId: row['marketId'] == null ? '' : String(row['marketId']),
            name: String(row['name'] ?? ''),
            capacityKg:
                row['capacityKg'] == null || row['capacityKg'] === ''
                    ? null
                    : Number(row['capacityKg']),
            managedBy:
                row['managedBy'] == null || row['managedBy'] === ''
                    ? ''
                    : String(row['managedBy']),
            address: String(row['address'] ?? ''),
            latitude:
                row['latitude'] == null || row['latitude'] === ''
                    ? null
                    : Number(row['latitude']),
            longitude:
                row['longitude'] == null || row['longitude'] === ''
                    ? null
                    : Number(row['longitude']),
        });
    }

    /** Generic label/value pairs for an oversight row of unknown shape. */
    entriesOf(row: CrudRow): { label: string; value: string }[] {
        return Object.entries(row)
            .filter(
                ([key, v]) =>
                    key !== 'id' &&
                    (v === null ||
                        v === undefined ||
                        ['string', 'number', 'boolean'].includes(typeof v))
            )
            .map(([key, value]) => ({
                label: this._humanizeKey(key),
                value: this._formatOversightValue(key, value),
            }));
    }

    private _humanizeKey(key: string): string {
        const spaced = key
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\bId\b/gi, 'ID')
            .trim();
        return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    }

    private _formatOversightValue(key: string, value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        if (typeof value === 'boolean') {
            return value ? '✓' : '✗';
        }
        if (typeof value === 'string' && /(At|Date)$/.test(key)) {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                return date.toLocaleString(this._transloco.getActiveLang());
            }
        }
        return String(value);
    }

    private _formatMeta(value: unknown, kind?: 'date' | 'kg' | '%'): string {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        if (kind === 'date') {
            const date = new Date(String(value));
            return Number.isNaN(date.getTime())
                ? ''
                : date.toLocaleString(this._transloco.getActiveLang());
        }
        if (kind === 'kg') {
            const n = Number(value);
            return Number.isNaN(n)
                ? String(value)
                : `${n.toLocaleString(this._transloco.getActiveLang())} kg`;
        }
        if (kind === '%') {
            const n = Number(value);
            return Number.isNaN(n)
                ? String(value)
                : `${n.toLocaleString(this._transloco.getActiveLang())}%`;
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
