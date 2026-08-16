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
 * (`GET /logistics/routes/{id}` — `RouteStopDto` carries lat/lng). Goong
 * Direction then supplies the road geometry for every consecutive leg, just
 * as it does in the driver app. A stop without coordinates is skipped rather
 * than dropped at (0, 0) in the Gulf of Guinea.
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
                    @if (roadPathUnavailable()) {
                        <p class="ff-route-map__notice">
                            {{ t('admin.routes.map.roadPathUnavailable') }}
                        </p>
                    }
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

            .ff-route-map__notice {
                position: absolute;
                right: 0.75rem;
                bottom: 0.75rem;
                left: 0.75rem;
                margin: 0;
                border-radius: 0.5rem;
                background: rgba(255, 255, 255, 0.94);
                padding: 0.5rem 0.75rem;
                color: #475569;
                font-size: 0.75rem;
                text-align: center;
                box-shadow: 0 1px 4px rgba(15, 23, 42, 0.16);
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

    /** Stops remain useful even when Goong cannot return the driven path. */
    readonly roadPathUnavailable = signal(false);

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
            const roadPoints = await this._roadPath(points);
            this.roadPathUnavailable.set(
                points.length > 1 && roadPoints.length < 2
            );
            this._addLine(map, roadPoints);
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

    /** Fetches every consecutive road leg and joins them into one path. */
    private async _roadPath(points: readonly LngLat[]): Promise<LngLat[]> {
        if (points.length < 2) {
            return [];
        }
        const segments = await Promise.all(
            points
                .slice(0, -1)
                .map((point, index) =>
                    this._maps.drivingDirections(point, points[index + 1])
                )
        );
        // Do not bridge a failed leg with a straight line between two unrelated
        // polylines. If one request fails, markers still show the stop order.
        if (segments.some((segment) => segment.length < 2)) {
            return [];
        }
        return segments.flatMap((segment, index) =>
            index === 0 ? segment : segment.slice(1)
        );
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
            paint: {
                'line-color': '#3f51b5',
                'line-width': 4,
                'line-opacity': 0.9,
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
