/**
 * Minimal typings for the parts of the Goong Maps JS SDK (`goong-js`, a
 * Mapbox GL fork) and the Goong REST API that this app uses. The SDK is loaded
 * lazily at runtime from a CDN (see {@link GoongMapService}) rather than
 * bundled, so we declare only the surface we touch instead of pulling in the
 * full upstream types.
 */

/** A `[longitude, latitude]` pair, the order the Goong/Mapbox SDK expects. */
export type LngLat = [number, number];

/** Geographic coordinate, as returned by marker/map events. */
export interface GoongLngLat {
    lng: number;
    lat: number;
}

export interface GoongMapOptions {
    container: HTMLElement;
    style: string;
    center: LngLat;
    zoom: number;
}

export interface GoongMapMouseEvent {
    lngLat: GoongLngLat;
}

/** A GeoJSON LineString source — what a drawn route is made of. */
export interface GoongLineSource {
    type: 'geojson';
    data: {
        type: 'Feature';
        properties: Record<string, unknown>;
        geometry: { type: 'LineString'; coordinates: LngLat[] };
    };
}

/** Paint properties for the drawn route. */
export interface GoongLineLayer {
    id: string;
    type: 'line';
    source: string;
    layout?: { 'line-cap'?: string; 'line-join'?: string };
    paint?: {
        'line-color'?: string;
        'line-width'?: number;
        'line-opacity'?: number;
        'line-dasharray'?: number[];
    };
}

export interface GoongMap {
    on(type: 'load', handler: () => void): void;
    on(type: 'click', handler: (event: GoongMapMouseEvent) => void): void;
    flyTo(options: { center: LngLat; zoom?: number }): void;
    resize(): void;
    remove(): void;

    /*
     * The line-drawing surface. Goong's SDK is a Mapbox GL fork, so these exist
     * at runtime; they are declared here because this app now draws a route
     * between stops rather than only dropping pins.
     */
    addSource(id: string, source: GoongLineSource): void;
    removeSource(id: string): void;
    getSource(id: string): unknown;
    addLayer(layer: GoongLineLayer): void;
    removeLayer(id: string): void;
    getLayer(id: string): unknown;
    fitBounds(
        bounds: [LngLat, LngLat],
        options?: { padding?: number; maxZoom?: number; duration?: number }
    ): void;
}

export interface GoongMarkerOptions {
    draggable?: boolean;
    color?: string;
}

export interface GoongMarker {
    setLngLat(lngLat: LngLat): GoongMarker;
    addTo(map: GoongMap): GoongMarker;
    getLngLat(): GoongLngLat;
    on(type: 'dragend', handler: () => void): void;
    /** Detaches the marker — a route redraw replaces its whole pin set. */
    remove(): void;
}

/** The `goongjs` global exposed by the SDK script once loaded. */
export interface GoongJs {
    accessToken: string;
    Map: new (options: GoongMapOptions) => GoongMap;
    Marker: new (options?: GoongMarkerOptions) => GoongMarker;
}

/** One suggestion from `Place/AutoComplete`. */
export interface GoongPlaceSuggestion {
    placeId: string;
    description: string;
}
