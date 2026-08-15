import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    ViewEncapsulation,
    computed,
    effect,
    inject,
    input,
    signal,
    untracked,
    viewChild,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { GoongMapService } from 'app/core/maps/goong-map.service';
import { GoongMap, GoongMarker, LngLat } from 'app/core/maps/goong.types';
import { RouteStop } from './logistics-admin.types';

/** Line id, reused for both the source and the layer drawn from it. */
const ROUTE_LINE = 'ff-route-line';

/** Ho Chi Minh City — where the map sits until stops give it somewhere better. */
const FALLBACK_CENTER: LngLat = [106.7009, 10.7769];

/**
 * A planned route drawn on a map: the hub, each stop in the order the driver
 * takes them, and the line between.
 *
 * The stop list beside it says *what* the route visits; this says what it
 * looks like — whether the day doubles back across the city, whether two stops
 * are neighbours, whether the order is sensible. That is not readable from a
 * column of names and ETAs.
 *
 * Coordinates come from the route the panel already fetched
 * (`GET /logistics/routes/{id}` — `RouteStopDto` carries lat/lng), so drawing
 * this costs no extra request. A stop without coordinates is skipped rather
 * than dropped at (0, 0) in the Gulf of Guinea; if fewer than two remain there
 * is no line to draw and the component says so instead of showing an empty
 * ocean.
 */
@Component({
    selector: 'admin-route-map',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TranslocoModule],
    template: `
        <ng-container *transloco="let t">
            @if (!mappable().length) {
                <p class="ff-route-map__empty">
                    {{ t('admin.routes.map.noCoordinates') }}
                </p>
            } @else {
                <div class="ff-route-map">
                    <div class="ff-route-map__canvas" #canvas></div>
                    @if (failed()) {
                        <p class="ff-route-map__empty">
                            {{ t('admin.routes.map.unavailable') }}
                        </p>
                    }
                </div>
            }
        </ng-container>
    `,
    styles: [
        `
            .ff-route-map {
                position: relative;
                overflow: hidden;
                border-radius: 0.75rem;
                border: 1px solid var(--fuse-border);
            }

            .ff-route-map__canvas {
                height: 16rem;
                width: 100%;
            }

            .ff-route-map__empty {
                padding: 1rem;
                font-size: 0.8125rem;
                text-align: center;
            }
        `,
    ],
})
export class RouteMapComponent {
    private readonly _maps = inject(GoongMapService);
    private readonly _destroyRef = inject(DestroyRef);

    readonly stops = input.required<readonly RouteStop[]>();

    private readonly _canvas = viewChild<ElementRef<HTMLElement>>('canvas');

    /** True once the SDK or the key has let us down; the panel keeps working. */
    readonly failed = signal(false);

    /** Stops the map can actually place, in the driver's order. */
    readonly mappable = computed(() =>
        [...this.stops()]
            .filter(
                (stop) =>
                    typeof stop.latitude === 'number' &&
                    typeof stop.longitude === 'number'
            )
            .sort((a, b) => a.stopOrder - b.stopOrder)
    );

    private _map: GoongMap | null = null;
    private _markers: GoongMarker[] = [];
    private _drawing = false;

    constructor() {
        effect(() => {
            const canvas = this._canvas();
            const stops = this.mappable();
            if (!canvas || !stops.length) {
                return;
            }
            untracked(() => void this._draw(canvas.nativeElement, stops));
        });

        this._destroyRef.onDestroy(() => this._teardown());
    }

    private async _draw(
        container: HTMLElement,
        stops: readonly RouteStop[]
    ): Promise<void> {
        if (this._drawing) {
            return;
        }
        this._drawing = true;
        try {
            const points: LngLat[] = stops.map((stop) => [
                stop.longitude as number,
                stop.latitude as number,
            ]);
            const map =
                this._map ??
                (await this._maps.createMap(container, {
                    center: points[0] ?? FALLBACK_CENTER,
                    zoom: 12,
                }));
            this._map = map;

            this._clearOverlay();
            await this._addMarkers(map, stops, points);
            this._addLine(map, points);
            this._fit(map, points);
        } catch {
            // A missing key or a blocked CDN must not take the routing panel
            // with it — the stop list beside this is the source of truth.
            this.failed.set(true);
            this._teardown();
        } finally {
            this._drawing = false;
        }
    }

    private async _addMarkers(
        map: GoongMap,
        stops: readonly RouteStop[],
        points: readonly LngLat[]
    ): Promise<void> {
        for (const [index, point] of points.entries()) {
            const marker = await this._maps.createMarker({
                // The hub is where the day starts, so it is not one more stop.
                color:
                    stops[index].entityType === 'hub' ? '#0f766e' : '#3f51b5',
            });
            marker.setLngLat(point).addTo(map);
            this._markers.push(marker);
        }
    }

    private _addLine(map: GoongMap, points: readonly LngLat[]): void {
        if (points.length < 2) {
            return;
        }
        map.addSource(ROUTE_LINE, {
            type: 'geojson',
            data: {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: [...points] },
            },
        });
        map.addLayer({
            id: ROUTE_LINE,
            type: 'line',
            source: ROUTE_LINE,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            // Straight legs between stops, not a driven path: the plan gives an
            // order and an ETA, not a road geometry, and drawing a smooth road
            // line would claim a route the planner never returned.
            paint: {
                'line-color': '#3f51b5',
                'line-width': 3,
                'line-opacity': 0.85,
                'line-dasharray': [2, 1.5],
            },
        });
    }

    /** Frames every stop, with room so a marker never sits on the edge. */
    private _fit(map: GoongMap, points: readonly LngLat[]): void {
        if (points.length === 1) {
            map.flyTo({ center: points[0], zoom: 13 });
            return;
        }
        const lngs = points.map((p) => p[0]);
        const lats = points.map((p) => p[1]);
        map.fitBounds(
            [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
            ],
            { padding: 48, maxZoom: 14, duration: 0 }
        );
    }

    private _clearOverlay(): void {
        for (const marker of this._markers) {
            marker.remove();
        }
        this._markers = [];
        const map = this._map;
        if (!map) {
            return;
        }
        if (map.getLayer(ROUTE_LINE)) {
            map.removeLayer(ROUTE_LINE);
        }
        if (map.getSource(ROUTE_LINE)) {
            map.removeSource(ROUTE_LINE);
        }
    }

    private _teardown(): void {
        this._clearOverlay();
        this._map?.remove();
        this._map = null;
    }
}
