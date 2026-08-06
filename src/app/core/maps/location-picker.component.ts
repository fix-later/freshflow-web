import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    Input,
    OnDestroy,
    ViewChild,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule } from '@jsverse/transloco';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { GoongMapService } from './goong-map.service';
import { GoongMap, GoongMarker, GoongPlaceSuggestion } from './goong.types';

/** Map centre used before any coordinate is chosen (Hồ Chí Minh City). */
const DEFAULT_CENTER: [number, number] = [106.7009, 10.7769];

/**
 * Reusable latitude/longitude picker. Renders a Goong Places search box, an
 * interactive map with a draggable marker, and manual lat/long number inputs —
 * all bound to the two `FormControl`s passed in, kept in two-way sync. The map
 * is a progressive enhancement: if the SDK/key is unavailable, the search box
 * and manual inputs still work.
 */
@Component({
    selector: 'app-location-picker',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatProgressSpinnerModule,
        TranslocoModule,
    ],
    template: `
        <div class="flex flex-col gap-2" *transloco="let t">
            <!-- Place search -->
            <mat-form-field subscriptSizing="dynamic">
                <mat-label>{{ t(searchLabelKey) }}</mat-label>
                <mat-icon
                    matPrefix
                    class="ml-2 mr-1"
                    svgIcon="heroicons_outline:magnifying-glass"
                ></mat-icon>
                <input
                    matInput
                    [value]="query()"
                    [placeholder]="t('maps.searchPlaceholder')"
                    (input)="onSearch($any($event.target).value)"
                    (focus)="showSuggestions.set(true)"
                    autocomplete="off"
                />
            </mat-form-field>

            @if (showSuggestions() && suggestions().length) {
                <ul
                    class="bg-card -mt-1 divide-y overflow-hidden rounded-xl border text-sm"
                >
                    @for (s of suggestions(); track s.placeId) {
                        <li>
                            <button
                                type="button"
                                class="w-full px-3 py-2 text-left hover:bg-hover"
                                (click)="pickSuggestion(s)"
                            >
                                {{ s.description }}
                            </button>
                        </li>
                    }
                </ul>
            }

            <!-- Interactive map (progressive enhancement) -->
            @if (mapsEnabled) {
                <div class="relative overflow-hidden rounded-xl border">
                    <div
                        #mapContainer
                        [class]="'w-full ' + mapHeightClass"
                    ></div>
                    @if (mapLoading()) {
                        <div
                            class="bg-card/80 absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 backdrop-blur-sm"
                            role="status"
                            [attr.aria-label]="t('maps.loading')"
                        >
                            <mat-progress-spinner
                                mode="indeterminate"
                                [diameter]="36"
                                color="primary"
                            ></mat-progress-spinner>
                            <span class="text-secondary text-xs font-medium">
                                {{ t('maps.loading') }}
                            </span>
                        </div>
                    } @else {
                        <p
                            class="text-secondary pointer-events-none absolute bottom-1 left-2 text-xs"
                        >
                            {{ t('maps.mapHint') }}
                        </p>
                    }
                </div>
            } @else {
                <!--
                  No Maptiles key in this build. The map is a progressive
                  enhancement, so the form still works — but vanishing without a
                  word is indistinguishable from the feature not existing, and
                  it is what a deployment built without a GOONG_MAPS_KEY looks
                  like from the outside. Say the map is unavailable and point at
                  the input that still does the job.
                -->
                <p
                    class="text-secondary rounded-xl border border-dashed p-3 text-xs"
                >
                    {{ t('maps.unavailable') }}
                </p>
            }

            <!-- Manual entry (optional — hidden when address search owns the coords) -->
            @if (showManualCoords) {
                <div class="flex gap-2">
                    <mat-form-field class="flex-1" subscriptSizing="dynamic">
                        <mat-label>{{ t('maps.latitude') }}</mat-label>
                        <input
                            matInput
                            type="number"
                            step="any"
                            [formControl]="latControl"
                        />
                    </mat-form-field>
                    <mat-form-field class="flex-1" subscriptSizing="dynamic">
                        <mat-label>{{ t('maps.longitude') }}</mat-label>
                        <input
                            matInput
                            type="number"
                            step="any"
                            [formControl]="lngControl"
                        />
                    </mat-form-field>
                </div>
            }
        </div>
    `,
})
export class LocationPickerComponent implements AfterViewInit, OnDestroy {
    @Input({ required: true }) latControl!: FormControl;
    @Input({ required: true }) lngControl!: FormControl;
    /**
     * Optional control the search box is bound to (two-way). Pass the market's
     * address here so the saved address seeds the search — one field feeds both
     * geocoding and the stored address, instead of typing it twice.
     */
    @Input() queryControl?: FormControl;
    /** i18n key for the search field label (default: generic "search place"). */
    @Input() searchLabelKey = 'maps.searchLabel';
    /**
     * When false, hides the manual lat/lng number inputs (address search + map
     * still write coordinates). Used when a single address field owns the pick.
     */
    @Input() showManualCoords = true;
    /** Tailwind height class for the map pane (default `h-56`). */
    @Input() mapHeightClass = 'h-56';
    @ViewChild('mapContainer') private _mapContainer?: ElementRef<HTMLElement>;

    private readonly _goong = inject(GoongMapService);

    readonly mapsEnabled = this._goong.mapsEnabled;
    readonly query = signal('');
    readonly suggestions = signal<GoongPlaceSuggestion[]>([]);
    readonly showSuggestions = signal(false);
    /** True from first paint until the Goong SDK + tiles are ready. */
    readonly mapLoading = signal(this._goong.mapsEnabled);

    private readonly _search$ = new Subject<string>();
    private readonly _subs = new Subscription();
    private _map: GoongMap | null = null;
    private _marker: GoongMarker | null = null;
    /** Guards against feedback loops when the map writes back to the controls. */
    private _syncingFromMap = false;

    constructor() {
        this._subs.add(
            this._search$
                .pipe(
                    debounceTime(300),
                    switchMap((term) => this._goong.autocomplete(term))
                )
                .subscribe((results) => this.suggestions.set(results))
        );
    }

    ngAfterViewInit(): void {
        // Seed the search box from the bound control (e.g. a saved address) and
        // keep it in sync when the parent resets the form.
        if (this.queryControl) {
            this.query.set(String(this.queryControl.value ?? ''));
            this._subs.add(
                this.queryControl.valueChanges.subscribe((value) => {
                    const text = String(value ?? '');
                    if (text !== this.query()) {
                        this.query.set(text);
                    }
                })
            );
        }
        // React to manual edits: move the marker to match typed coordinates.
        this._subs.add(
            this.latControl.valueChanges.subscribe(() => this._syncMarker())
        );
        this._subs.add(
            this.lngControl.valueChanges.subscribe(() => this._syncMarker())
        );
        void this._initMap();
    }

    ngOnDestroy(): void {
        this._subs.unsubscribe();
        this._map?.remove();
    }

    onSearch(value: string): void {
        this.query.set(value);
        this.queryControl?.setValue(value, { emitEvent: false });
        this.showSuggestions.set(true);
        this._search$.next(value);
    }

    async pickSuggestion(s: GoongPlaceSuggestion): Promise<void> {
        this.query.set(s.description);
        this.queryControl?.setValue(s.description, { emitEvent: false });
        this.suggestions.set([]);
        this.showSuggestions.set(false);
        const loc = await this._goong.placeDetail(s.placeId);
        if (loc) {
            this._setCoords(loc.lat, loc.lng, true);
        }
    }

    private async _initMap(): Promise<void> {
        if (!this.mapsEnabled || !this._mapContainer) {
            this.mapLoading.set(false);
            return;
        }
        try {
            const lat = this._num(this.latControl.value);
            const lng = this._num(this.lngControl.value);
            const center: [number, number] =
                lat != null && lng != null ? [lng, lat] : DEFAULT_CENTER;
            this._map = await this._goong.createMap(
                this._mapContainer.nativeElement,
                { center, zoom: lat != null ? 14 : 11 }
            );
            this._map.resize();
            this._map.on('click', (e) =>
                this._setCoords(e.lngLat.lat, e.lngLat.lng, false)
            );
            if (lat != null && lng != null) {
                await this._syncMarker();
            }
        } catch {
            // Map is optional — manual entry and search remain usable.
            this._map = null;
        } finally {
            this.mapLoading.set(false);
        }
    }

    /** Ensures a draggable marker exists at the current coordinates. */
    private async _syncMarker(): Promise<void> {
        if (this._syncingFromMap || !this._map) {
            return;
        }
        const lat = this._num(this.latControl.value);
        const lng = this._num(this.lngControl.value);
        if (lat == null || lng == null) {
            return;
        }
        if (!this._marker) {
            this._marker = await this._goong.createMarker({
                draggable: true,
                color: '#16a34a',
            });
            // Position must be set before addTo(): the SDK reads the marker's
            // lngLat on its first render and throws if it is still undefined.
            this._marker.setLngLat([lng, lat]);
            this._marker.on('dragend', () => {
                const pos = this._marker!.getLngLat();
                this._setCoords(pos.lat, pos.lng, false);
            });
            this._marker.addTo(this._map);
            return;
        }
        this._marker.setLngLat([lng, lat]);
    }

    /** Writes coordinates back to the controls, optionally recentering. */
    private _setCoords(lat: number, lng: number, recenter: boolean): void {
        this._syncingFromMap = true;
        this.latControl.setValue(this._round(lat));
        this.lngControl.setValue(this._round(lng));
        this.latControl.markAsDirty();
        this.lngControl.markAsDirty();
        this._syncingFromMap = false;
        if (recenter) {
            this._map?.flyTo({ center: [lng, lat], zoom: 15 });
        }
        void this._syncMarker();
    }

    private _num(value: unknown): number | null {
        if (value === '' || value == null) {
            return null;
        }
        const n = Number(value);
        return Number.isNaN(n) ? null : n;
    }

    private _round(n: number): number {
        return Math.round(n * 1e6) / 1e6;
    }
}
