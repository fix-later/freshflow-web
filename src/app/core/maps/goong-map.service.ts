import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import {
    GoongJs,
    GoongMap,
    GoongMapOptions,
    GoongMarker,
    GoongMarkerOptions,
    GoongPlaceSuggestion,
} from './goong.types';

/** Pinned Goong JS SDK version served from jsDelivr. */
const SDK_VERSION = '1.0.9';
const SDK_JS = `https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@${SDK_VERSION}/dist/goong-js.js`;
const SDK_CSS = `https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@${SDK_VERSION}/dist/goong-js.css`;
const TILE_STYLE = 'https://tiles.goong.io/assets/goong_map_web.json';
const REST_BASE = 'https://rsapi.goong.io';

/**
 * Thin wrapper around Goong.io. Lazily injects the map SDK from a CDN (so it
 * never weighs on the initial bundle) and exposes the two Places REST calls the
 * location picker needs. Every method degrades gracefully — a failed SDK load
 * or REST call rejects/returns empty so the caller can fall back to manual
 * latitude/longitude entry.
 */
@Injectable({ providedIn: 'root' })
export class GoongMapService {
    private _sdk: Promise<GoongJs> | null = null;

    /** True when a Maptiles key is configured (map rendering is possible). */
    get mapsEnabled(): boolean {
        return !!environment.goongMapsKey;
    }

    /** Loads the SDK once and returns the `goongjs` global. */
    loadSdk(): Promise<GoongJs> {
        if (this._sdk) {
            return this._sdk;
        }
        this._sdk = new Promise<GoongJs>((resolve, reject) => {
            const existing = (window as unknown as { goongjs?: GoongJs })
                .goongjs;
            if (existing) {
                existing.accessToken = environment.goongMapsKey;
                resolve(existing);
                return;
            }
            if (!document.querySelector(`link[href="${SDK_CSS}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = SDK_CSS;
                document.head.appendChild(link);
            }
            const script = document.createElement('script');
            script.src = SDK_JS;
            script.async = true;
            script.onload = () => {
                const goongjs = (window as unknown as { goongjs?: GoongJs })
                    .goongjs;
                if (!goongjs) {
                    reject(new Error('goong-js failed to initialize'));
                    return;
                }
                goongjs.accessToken = environment.goongMapsKey;
                resolve(goongjs);
            };
            script.onerror = () =>
                reject(new Error('Failed to load goong-js SDK'));
            document.head.appendChild(script);
        });
        return this._sdk;
    }

    /** Creates a map bound to `container`, resolving once its tiles are ready. */
    async createMap(
        container: HTMLElement,
        options: Omit<GoongMapOptions, 'container' | 'style'>
    ): Promise<GoongMap> {
        const goongjs = await this.loadSdk();
        const map = new goongjs.Map({
            container,
            style: `${TILE_STYLE}?api_key=${environment.goongMapsKey}`,
            ...options,
        });
        await new Promise<void>((resolve) => map.on('load', () => resolve()));
        return map;
    }

    /** Creates a marker (not yet added to any map). */
    async createMarker(options?: GoongMarkerOptions): Promise<GoongMarker> {
        const goongjs = await this.loadSdk();
        return new goongjs.Marker(options);
    }

    /** Place autocomplete around Vietnam; returns [] on any failure. */
    async autocomplete(input: string): Promise<GoongPlaceSuggestion[]> {
        const term = input.trim();
        if (!term || !environment.goongPlacesKey) {
            return [];
        }
        const url =
            `${REST_BASE}/Place/AutoComplete` +
            `?api_key=${environment.goongPlacesKey}` +
            `&input=${encodeURIComponent(term)}`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                return [];
            }
            const body = (await res.json()) as {
                predictions?: { place_id?: string; description?: string }[];
            };
            return (body.predictions ?? [])
                .filter((p) => p.place_id && p.description)
                .map((p) => ({
                    placeId: p.place_id as string,
                    description: p.description as string,
                }));
        } catch {
            return [];
        }
    }

    /** Resolves a place id to coordinates; null on any failure. */
    async placeDetail(
        placeId: string
    ): Promise<{ lat: number; lng: number } | null> {
        if (!environment.goongPlacesKey) {
            return null;
        }
        const url =
            `${REST_BASE}/Place/Detail` +
            `?api_key=${environment.goongPlacesKey}` +
            `&place_id=${encodeURIComponent(placeId)}`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                return null;
            }
            const body = (await res.json()) as {
                result?: {
                    geometry?: { location?: { lat: number; lng: number } };
                };
            };
            const loc = body.result?.geometry?.location;
            return loc ? { lat: loc.lat, lng: loc.lng } : null;
        } catch {
            return null;
        }
    }
}
