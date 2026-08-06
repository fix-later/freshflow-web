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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { describeApiError } from 'app/core/api/error-codes';
import {
    latitudeValidator,
    longitudeValidator,
    nonBlankValidator,
    trimmedMaxLengthValidator,
} from 'app/core/api/validators';
import { LocationPickerComponent } from 'app/core/maps/location-picker.component';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { CrudRow } from '../shared/resource-crud.types';
import {
    CatalogAdminService,
    MARKET_ADDRESS_MAX_LENGTH,
    MARKET_DESCRIPTION_MAX_LENGTH,
    MARKET_LOCATION_MAX_LENGTH,
    MARKET_NAME_MAX_LENGTH,
} from './catalog-admin.service';
import { MarketProductsComponent } from './market-products.component';

/** Read-only MarketDto fields for the detail grid. */
const META_FIELDS: { key: string; label: string; kind?: 'date' }[] = [
    { key: 'id', label: 'admin.crud.id' },
    { key: 'createdAt', label: 'admin.crud.createdAt', kind: 'date' },
    { key: 'updatedAt', label: 'admin.crud.updatedAt', kind: 'date' },
];

/**
 * Admin ▸ Catalog ▸ Markets ▸ Edit — full-page editor (map + fields), same
 * pattern as hub edit so the list stays scannable.
 */
@Component({
    selector: 'admin-market-edit',
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
        MatTabsModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslocoModule,
        LocationPickerComponent,
        MarketProductsComponent,
    ],
    templateUrl: './market-edit.component.html',
    styles: [
        `
            .market-edit-tabs .mdc-tab {
                min-width: 0;
                height: 38px;
                padding: 0 0.75rem;
            }

            .market-edit-tabs .mdc-tab__text-label {
                font-size: 1rem;
                font-weight: 600;
            }

            .market-edit-tabs .mdc-tab-indicator__content--underline {
                border-top-width: 3px;
                transform: translateY(-2px);
            }

            .market-edit-tabs .mdc-tab-indicator {
                bottom: -1px;
            }
        `,
    ],
})
export class MarketEditComponent implements OnInit {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _admin = inject(AdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _confirmation = inject(FuseConfirmationService);

    readonly market = signal<CrudRow | null>(null);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly notFound = signal(false);
    readonly agentOptions = signal<AdminUserRow[]>([]);
    /** Agent assigned when the page loaded (for setMarketAgent previous id). */
    readonly previousAgentId = signal<string | null>(null);
    readonly selectedTab = signal(0);
    readonly pricingTabLoaded = signal(false);

    readonly marketName = computed(() => String(this.market()?.['name'] ?? ''));
    readonly isActive = computed(() => this.market()?.isActive !== false);

    readonly metaEntries = computed(() => {
        const row = this.market();
        if (!row) {
            return [];
        }
        return META_FIELDS.map(({ key, label, kind }) => ({
            label,
            value: this._formatMeta(row[key], kind),
        })).filter((e) => e.value !== '');
    });

    // `UpdateMarketCommandValidator` shares its limits with the create one —
    // see `market-create.component.ts`.
    readonly form = new FormGroup({
        name: new FormControl('', {
            nonNullable: true,
            validators: [
                Validators.required,
                nonBlankValidator,
                trimmedMaxLengthValidator(MARKET_NAME_MAX_LENGTH),
            ],
        }),
        location: new FormControl('', {
            nonNullable: true,
            validators: [trimmedMaxLengthValidator(MARKET_LOCATION_MAX_LENGTH)],
        }),
        agentUserId: new FormControl('', { nonNullable: true }),
        description: new FormControl('', {
            nonNullable: true,
            validators: [
                trimmedMaxLengthValidator(MARKET_DESCRIPTION_MAX_LENGTH),
            ],
        }),
        imageUrl: new FormControl('', { nonNullable: true }),
        address: new FormControl('', {
            nonNullable: true,
            validators: [trimmedMaxLengthValidator(MARKET_ADDRESS_MAX_LENGTH)],
        }),
        latitude: new FormControl<number | null>(null, [latitudeValidator]),
        longitude: new FormControl<number | null>(null, [longitudeValidator]),
    });

    readonly uploading = signal(false);

    /** Uploads the picked file and stores the hosted URL in `imageUrl`. */
    onImagePicked(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file || this.uploading()) {
            return;
        }
        this.uploading.set(true);
        void this._catalog
            .uploadMarketImage(file)
            .then((url) => this.form.controls.imageUrl.setValue(url))
            .catch(
                (err) =>
                    void this._notifyError(err, 'admin.crud.image.uploadError')
            )
            .finally(() => this.uploading.set(false));
    }

    clearImage(): void {
        this.form.controls.imageUrl.setValue('');
    }

    ngOnInit(): void {
        this._applyInitialTab();

        const id = this._route.snapshot.paramMap.get('marketId') ?? '';
        const passed = (history.state?.market ?? null) as CrudRow | null;
        if (passed && passed.id === id) {
            this._apply(passed);
            this._fetch(id, /* keepVisible */ true);
            void this._loadAgents(id);
            return;
        }
        if (id) {
            this._fetch(id);
            void this._loadAgents(id);
            return;
        }
        this.notFound.set(true);
    }

    goBack(): void {
        void this._router.navigate(['/admin/markets']);
    }

    onTabChange(index: number): void {
        this.selectedTab.set(index);
        if (index === 1) {
            this.pricingTabLoaded.set(true);
        }
    }

    save(): void {
        const row = this.market();
        if (!row || this.form.invalid || this.saving() || this.uploading()) {
            this.form.markAllAsTouched();
            return;
        }
        this.saving.set(true);
        const value = this.form.getRawValue();
        const agentUserId = value.agentUserId || null;
        void this._catalog
            .updateMarket(row.id, {
                name: value.name,
                location: value.location || null,
                description: value.description || null,
                imageUrl: value.imageUrl || null,
                address: value.address || null,
                latitude: value.latitude,
                longitude: value.longitude,
            })
            .then(() =>
                this._admin.setMarketAgent(
                    row.id,
                    agentUserId,
                    this.previousAgentId()
                )
            )
            .then(() => {
                this._notify('admin.crud.updateSuccess');
                this.goBack();
            })
            .catch((err) => void this._notifyError(err, 'admin.crud.saveError'))
            .finally(() => this.saving.set(false));
    }

    deactivate(): void {
        const row = this.market();
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
                .deactivateMarket(row.id)
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

    /**
     * Permanently deletes the market, as opposed to retiring it.
     *
     * Whether this market *can* be deleted is the server's decision — a market
     * with listings or order history is refused, and that refusal is shown as
     * the reason rather than pre-judged here. The confirmation says the action
     * cannot be undone because `DELETE` has no counterpart.
     */
    deleteMarket(): void {
        const row = this.market();
        if (!row || this.saving()) {
            return;
        }
        const ref = this._confirmation.open({
            title: this._transloco.translate('admin.markets.delete.title'),
            message: this._transloco.translate('admin.markets.delete.message', {
                name: String(row['name'] ?? ''),
            }),
            actions: {
                confirm: {
                    label: this._transloco.translate(
                        'admin.markets.delete.confirm'
                    ),
                    color: 'warn',
                },
            },
        });
        ref.afterClosed().subscribe((result) => {
            if (result !== 'confirmed') {
                return;
            }
            this.saving.set(true);
            void this._catalog
                .deleteMarket(row.id)
                .then(() => {
                    this._notify('admin.markets.delete.success');
                    this.goBack();
                })
                .catch(
                    (err) =>
                        void this._notifyError(
                            err,
                            'admin.markets.delete.error'
                        )
                )
                .finally(() => this.saving.set(false));
        });
    }

    agentLabel(agent: AdminUserRow): string {
        return agent.email || String(agent['name'] ?? agent.id);
    }

    private _applyInitialTab(): void {
        const tab =
            this._route.snapshot.data['tab'] ??
            this._route.snapshot.queryParamMap.get('tab');
        if (tab === 'pricing') {
            this.selectedTab.set(1);
            this.pricingTabLoaded.set(true);
        }
    }

    private _fetch(id: string, keepVisible = false): void {
        if (!keepVisible) {
            this.loading.set(true);
        }
        void this._catalog
            .getMarket(id)
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

    private async _loadAgents(marketId: string): Promise<void> {
        try {
            const { agents, agentsByMarket } =
                await this._admin.getMarketAgentsWithAssignments();
            this.agentOptions.set(agents);
            const current = agentsByMarket.get(marketId);
            const agentId = current?.id ?? '';
            this.previousAgentId.set(agentId || null);
            this.form.controls.agentUserId.setValue(agentId);
        } catch {
            this.agentOptions.set([]);
        }
    }

    private _apply(row: CrudRow): void {
        this.market.set(row);
        this.notFound.set(false);
        this.form.patchValue({
            name: String(row['name'] ?? ''),
            location: String(row['location'] ?? ''),
            description: String(row['description'] ?? ''),
            imageUrl: String(row['imageUrl'] ?? ''),
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
