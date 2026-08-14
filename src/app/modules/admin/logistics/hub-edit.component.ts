import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    inject,
    input,
    signal,
} from '@angular/core';
import {
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
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

interface MetaField {
    key: string;
    label: string;
    kind?: 'date' | 'kg' | '%';
}

/**
 * Read-only fields for the side column. Occupancy is not among them — it is
 * drawn as a meter instead — and neither is the id: a database key nobody reads
 * off the screen, which only crowded the panel.
 */
const TIMESTAMP_FIELDS: MetaField[] = [
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
    styles: [
        `
            /* The track needs its own outline: the hover token alone is a few
               percent of ink, which reads as nothing on the card. A border-width
               with no color picks up the themed border set globally. */
            .hub-meter {
                height: 0.75rem;
                width: 100%;
                overflow: hidden;
                border-radius: 9999px;
                border-width: 1px;
                background-color: var(--fuse-bg-hover);
            }

            .hub-meter-fill {
                height: 100%;
                border-radius: 9999px;
                transition: width 200ms ease;
            }

            .hub-meter-ok {
                background-color: var(--fuse-accent);
            }

            .hub-meter-tight {
                background-color: #b45309; /* amber-700 — the warning pill fill */
            }

            .hub-meter-full {
                background-color: #dc2626; /* red-600 — the danger pill fill */
            }
        `,
    ],
})
export class HubEditComponent implements OnInit {
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _confirmation = inject(FuseConfirmationService);

    /**
     * Rendered inside a chợ's hub tab: no page shell, and no back button — a
     * market has one hub, so the tab is the hub and there is nothing behind it.
     */
    readonly embedded = input(false);
    /** The hub to show when embedded; routed mode reads the URL instead. */
    readonly hubId = input('');

    readonly hub = signal<CrudRow | null>(null);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly notFound = signal(false);
    readonly marketOptions = signal<CrudOption[]>([]);
    readonly hubName = computed(() => String(this.hub()?.['name'] ?? ''));
    readonly isActive = computed(() => this.hub()?.isActive !== false);

    /**
     * Capacity as a meter. `utilizationPercent` is what the API reports; it is
     * recomputed from occupied/capacity only when the field is missing, and
     * clamped so a hub loaded past its rating still draws a full bar rather
     * than overflowing its track.
     */
    readonly utilizationPercent = computed(() => {
        const row = this.hub();
        if (!row) {
            return 0;
        }
        const reported = this._num(row['utilizationPercent']);
        const capacity = this._num(row['capacityKg']);
        const occupied = this._num(row['occupiedCapacityKg']);
        const percent =
            reported ??
            (capacity && capacity > 0 ? ((occupied ?? 0) / capacity) * 100 : 0);
        return Math.max(0, Math.min(100, Math.round(percent)));
    });

    readonly hasOccupancy = computed(
        () => this.occupiedLabel() !== '' || this.availableLabel() !== ''
    );

    readonly occupiedLabel = computed(() =>
        this._formatMeta(this.hub()?.['occupiedCapacityKg'], 'kg')
    );

    readonly availableLabel = computed(() =>
        this._formatMeta(this.hub()?.['availableCapacityKg'], 'kg')
    );

    /** Green while there is room, amber when tight, red once effectively full. */
    readonly meterClass = computed(() => {
        const percent = this.utilizationPercent();
        if (percent >= 90) {
            return 'hub-meter-full';
        }
        return percent >= 70 ? 'hub-meter-tight' : 'hub-meter-ok';
    });

    /** Created / updated, under the occupancy figures. */
    readonly timestampEntries = computed(() =>
        this._metaEntries(TIMESTAMP_FIELDS)
    );

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
            .marketOptions()
            .then((opts) => this.marketOptions.set(opts));

        // Embedded in a chợ's hub tab, the id arrives as an input; routed, it
        // comes from the URL.
        const id =
            this.hubId() || (this._route.snapshot.paramMap.get('hubId') ?? '');
        const passed = (history.state?.hub ?? null) as CrudRow | null;
        if (passed && passed.id === id) {
            this._apply(passed);
            // Refresh so capacity utilization / timestamps stay current.
            this._fetch(id, /* keepVisible */ true);
            return;
        }
        if (id) {
            this._fetch(id);
            return;
        }
        this.notFound.set(true);
    }

    /**
     * Back to the chợ this hub belongs to — hubs are configured from a market's
     * hub tab, and there is no hub list to return to. Falls back to the market
     * list if the hub has not loaded yet, or carries no market.
     */
    goBack(): void {
        const marketId = String(this.hub()?.['marketId'] ?? '');
        void this._router.navigate(
            marketId ? ['/admin/markets', marketId] : ['/admin/markets']
        );
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

    /** A finite number, or `null` for anything the API left blank. */
    private _num(value: unknown): number | null {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    /** Formats one group of read-only fields, dropping the empty ones. */
    private _metaEntries(
        fields: MetaField[]
    ): { label: string; value: string }[] {
        const row = this.hub();
        if (!row) {
            return [];
        }
        return fields
            .map(({ key, label, kind }) => ({
                label,
                value: this._formatMeta(row[key], kind),
            }))
            .filter((entry) => entry.value !== '');
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
