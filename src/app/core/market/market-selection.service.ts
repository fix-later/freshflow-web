import { Injectable, computed, signal } from '@angular/core';
import { extractList, parseJson } from 'app/core/api/envelope';
import { marketsApi } from 'contract';

/** A wholesale market the restaurant can shop from. */
export interface Market {
    id: string;
    name: string;
    address?: string;
    /** `MarketDto.ImageUrl` — market artwork, absent until an admin uploads one. */
    imageUrl?: string;
    /**
     * `MarketDto.Description` — free text the admin wrote about this market. The
     * storefront landing shows it as the market's speciality; there is no
     * dedicated speciality field, and inventing one would be inventing business
     * logic, so an empty description simply means no speciality line.
     */
    description?: string;
}

const STORAGE_KEY = 'freshflow.selectedMarket';

/** First non-empty string among `keys`. */
function str(row: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === 'string' && value.trim() !== '') {
            return value;
        }
    }
    return '';
}

/**
 * The market the restaurant is shopping from.
 *
 * Shopping is **scoped to one market at a time**: prices and availability are
 * per-market, so a basket mixing two markets could not be picked or delivered as
 * one run. The catalog therefore reads its listings from the selected market
 * only (`GET /markets/{id}/products`), and this service is the single place that
 * decides which one that is.
 *
 * The choice is remembered per browser so a returning buyer lands straight in
 * their market instead of being asked again.
 */
@Injectable({ providedIn: 'root' })
export class MarketSelectionService {
    private _markets = signal<Market[]>([]);
    private _selected = signal<Market | null>(this._restore());
    private _loading = signal(false);
    private _loaded = false;

    readonly markets = this._markets.asReadonly();
    readonly selected = this._selected.asReadonly();
    readonly loading = this._loading.asReadonly();

    /** Id the catalog keys its requests on — `null` until a market is chosen. */
    readonly selectedId = computed(() => this._selected()?.id ?? null);

    /** True once a market is chosen, i.e. the storefront can show products. */
    readonly hasSelection = computed(() => this._selected() !== null);

    /** Loads the market list once. Safe to call from every consumer. */
    async ensureLoaded(): Promise<void> {
        if (this._loaded || this._loading()) {
            return;
        }
        this._loading.set(true);
        try {
            const res = await marketsApi.apiV1MarketsGetRaw({
                activeOnly: true,
            });
            const rows = extractList<Record<string, unknown>>(
                await parseJson(res.raw)
            );
            const markets = rows
                .map((row) => ({
                    id: str(row, ['id', 'marketId']),
                    name: str(row, ['name', 'marketName']),
                    address: str(row, ['address', 'location']) || undefined,
                    imageUrl: str(row, ['imageUrl', 'image']) || undefined,
                    description: str(row, ['description']) || undefined,
                }))
                .filter((market) => !!market.id);
            this._markets.set(markets);
            this._loaded = true;
            this._reconcileSelection(markets);
        } catch {
            // Leave the list empty — the picker shows its empty state and the
            // catalog keeps whatever selection it had.
            this._markets.set([]);
        } finally {
            this._loading.set(false);
        }
    }

    /** Forces a refetch — used by the picker's retry after a failed load. */
    async reload(): Promise<void> {
        this._loaded = false;
        await this.ensureLoaded();
    }

    select(market: Market): void {
        this._selected.set(market);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(market));
        } catch {
            // Persistence is a convenience; the session still works without it.
        }
    }

    /**
     * A remembered market that no longer exists (deactivated, renamed id) would
     * make every catalog request 404. Drop it, and refresh the stored name when
     * it changed server-side.
     */
    private _reconcileSelection(markets: Market[]): void {
        const current = this._selected();
        if (!current) {
            return;
        }
        const live = markets.find((market) => market.id === current.id);
        if (!live) {
            this._selected.set(null);
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch {
                // Ignore — the in-memory clear is what matters.
            }
            return;
        }
        if (
            live.name !== current.name ||
            live.address !== current.address ||
            live.imageUrl !== current.imageUrl ||
            live.description !== current.description
        ) {
            this.select(live);
        }
    }

    private _restore(): Market | null {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) {
                return null;
            }
            const parsed = JSON.parse(stored) as Market;
            return parsed && typeof parsed.id === 'string' && parsed.id
                ? parsed
                : null;
        } catch {
            return null;
        }
    }
}
