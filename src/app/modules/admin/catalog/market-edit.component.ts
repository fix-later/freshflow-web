import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    computed,
    effect,
    inject,
    signal,
    untracked,
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
import { HubEditComponent } from '../logistics/hub-edit.component';
import { createHubResource } from '../logistics/hub-resource';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { createVehicleResource } from '../logistics/vehicle-resource';
import { AdminLoadingStateComponent } from '../shared/admin-loading-state.component';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource, CrudRow } from '../shared/resource-crud.types';
import {
    CatalogAdminService,
    MARKET_ADDRESS_MAX_LENGTH,
    MARKET_DESCRIPTION_MAX_LENGTH,
    MARKET_LOCATION_MAX_LENGTH,
    MARKET_NAME_MAX_LENGTH,
} from './catalog-admin.service';
import { MarketProductsComponent } from './market-products.component';
import { MarketStaffPanelComponent } from './market-staff-panel.component';
import {
    MARKET_HUBS_TAB,
    MARKET_TABS,
    marketTabIndexOf,
    marketTabSlugOf,
} from './market-tabs';

const HUBS_TAB = MARKET_HUBS_TAB;

/**
 * Read-only MarketDto fields for the detail column. The id is deliberately not
 * among them: it is a database key the admin never types or quotes, and it only
 * crowded the panel.
 */
const META_FIELDS: { key: string; label: string; kind?: 'date' }[] = [
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
        HubEditComponent,
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
        MarketStaffPanelComponent,
        ResourceCrudComponent,
    ],
    templateUrl: './market-edit.component.html',
    // No tab overrides: the stock Material tab bar keeps its own metrics, and
    // the ink bar slides between tabs instead of being nudged off its track by
    // a shortened height and a translated underline.
})
export class MarketEditComponent implements OnInit {
    private readonly _catalog = inject(CatalogAdminService);
    private readonly _logistics = inject(LogisticsAdminService);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _snackBar = inject(MatSnackBar);
    private readonly _transloco = inject(TranslocoService);
    private readonly _confirmation = inject(FuseConfirmationService);

    readonly market = signal<CrudRow | null>(null);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly notFound = signal(false);
    readonly tabs = MARKET_TABS;
    readonly selectedTab = signal(0);

    /**
     * The chợ's hub. A market has exactly one, so the tab shows it outright —
     * a list of one, with a row to click before anything can be read, was the
     * shape of a screen that expected many.
     *
     * `null` with {@link hubLoaded} true means this chợ has none yet, which is
     * the only time the tab offers the create form instead.
     */
    readonly hubId = signal<string | null>(null);
    readonly hubLoaded = signal(false);
    private _hubLoading = false;

    constructor() {
        /**
         * The hub tab's data, read from state rather than from the click that
         * opens the tab.
         *
         * It used to be fetched in `onTabChange`, which a click is not the only
         * way to reach: `?tab=hubs` selects the tab with no click at all, and
         * the tab then sat on its spinner forever because nothing had asked for
         * the hub — which is what happened whenever another page linked
         * straight into it.
         *
         * Two conditions, both required and neither guaranteed to arrive first:
         * the tab has to be the open one, *and* the market has to have loaded
         * (its id is what the hub is looked up by). An effect waits for
         * whichever is last without either having to know about the other.
         */
        effect(() => {
            const marketId = this.market()?.id;
            const wantsHub = this.selectedTab() === HUBS_TAB;
            if (!marketId || !wantsHub || this.hubLoaded()) {
                return;
            }
            untracked(() => void this._loadHub(marketId));
        });
    }

    /**
     * Hubs and vehicles are managed right here — neither has a nav entry of its
     * own any more. The hub list is scoped to this market and pins new hubs to
     * it; the fleet is platform-wide, so its tab edits the same rows the
     * standalone screen does. Both are the same CRUD definition the standalone
     * screens use, rendered without their page chrome.
     */
    readonly hubResource = computed<CrudResource | null>(() => {
        const marketId = this.market()?.id;
        return marketId
            ? createHubResource(
                  this._logistics,
                  this._router,
                  (key) => this._transloco.translate(key),
                  {
                      marketId,
                      openDetail: (hubId) => this.hubId.set(hubId),
                      // Creating the chợ's hub is the last thing this form is
                      // for: the tab turns into the hub itself right after.
                      onCreated: () => void this._loadHub(marketId),
                  }
              )
            : null;
    });

    readonly vehicleResource = computed<CrudResource | null>(() => {
        const marketId = this.market()?.id;
        return marketId
            ? createVehicleResource(
                  this._logistics,
                  (key) => this._transloco.translate(key),
                  { marketId }
              )
            : null;
    });

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

        // Only the market itself is read here. Everything a tab needs is read
        // when that tab is opened — see `onTabChange` and the panels below,
        // each of which fetches its own rows.
        const id = this._route.snapshot.paramMap.get('marketId') ?? '';
        const passed = (history.state?.market ?? null) as CrudRow | null;
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
        void this._router.navigate(['/admin/markets']);
    }

    onTabChange(index: number): void {
        this.selectedTab.set(index);

        // `replaceUrl` so tabbing across a page does not build a back-stack the
        // user has to unwind one tab at a time to leave the market.
        void this._router.navigate([], {
            relativeTo: this._route,
            queryParams: { tab: marketTabSlugOf(index) },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }

    /**
     * Reads the chợ's hub. Tolerates a market that somehow has several — the
     * backend does not enforce one — by showing the first, which is what the
     * list used to put at the top.
     */
    private async _loadHub(marketId: string): Promise<void> {
        // `hubLoaded` is only set when the read finishes, so without this a
        // second pass of the effect — the tab reselected while the first read
        // is still out — would issue the same request again.
        if (this._hubLoading) {
            return;
        }
        this._hubLoading = true;
        try {
            const hubs = await this._logistics.listHubs();
            const mine = hubs.find(
                (row) => String(row['marketId'] ?? '') === marketId
            );
            // Truthiness, not `??`: an id of `''` is not a hub this page can
            // open, but `??` only replaces null/undefined and would keep it —
            // which then travels into `/hubs/{hubId}/…` as an empty segment.
            this.hubId.set(mine?.id || null);
        } catch {
            this.hubId.set(null);
        } finally {
            this._hubLoading = false;
            this.hubLoaded.set(true);
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
        // Staff are not edited here — the staff tab owns that, and writes it
        // itself. This used to also push an agent diff, from a control the
        // template no longer renders; with nothing to diff it wrote nothing,
        // while its baseline read every agent on the platform at page load.
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

    /**
     * The tab named by the URL. `data.tab` is the legacy
     * `markets/:marketId/products` route, which still resolves here; everything
     * else travels as `?tab=`, so a tab is linkable and survives a reload
     * without each one needing a route of its own.
     */
    private _applyInitialTab(): void {
        const slug =
            (this._route.snapshot.data['tab'] as string | undefined) ??
            this._route.snapshot.queryParamMap.get('tab');
        this.selectedTab.set(marketTabIndexOf(slug));
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
