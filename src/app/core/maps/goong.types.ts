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

export interface GoongMap {
    on(type: 'load', handler: () => void): void;
    on(type: 'click', handler: (event: GoongMapMouseEvent) => void): void;
    flyTo(options: { center: LngLat; zoom?: number }): void;
    resize(): void;
    remove(): void;
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
