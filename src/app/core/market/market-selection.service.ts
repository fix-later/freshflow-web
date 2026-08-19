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
const LIST_KEY = 'freshflow.markets';

/** Bump when `Market` changes shape so old entries are discarded, not misread. */
const LIST_VERSION = 1;

/**
 * How long a cached market list is served without asking the server again.
 *
 * The list only moves when an admin creates or deactivates a market, which is
 * rare next to how often a buyer changes page — so an hour of staleness buys
 * one request per browsing session instead of one on every page load. A market
 * deactivated inside that window is still caught: `_reconcileSelection` drops a
 * selection the next fetch no longer lists, and the picker's retry calls
 * `reload()`, which ignores the cache.
 */
const LIST_TTL_MS = 60 * 60 * 1000;

/** The cached list as it sits in `localStorage`. */
interface CachedList {
    v: number;
    /** `Date.now()` at the time of the fetch. */
    at: number;
    markets: Market[];
}

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
 * Both the choice *and* the list are remembered per browser: the choice so a
 * returning buyer lands straight in their market instead of being asked again,
 * the list (for `LIST_TTL_MS`) so `GET /markets` is not re-issued on every page
 * the storefront loads.
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

    constructor() {
        const cached = this._restoreList();
        if (cached) {
            this._markets.set(cached);
            this._loaded = true;
            this._reconcileSelection(cached);
        }
    }

    /**
     * Loads the market list once. Safe to call from every consumer — a list
     * cached by an earlier page load already counts as loaded, so no request
     * goes out at all.
     */
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
            this._cacheList(markets);
            this._reconcileSelection(markets);
        } catch {
            // Leave the list empty — the picker shows its empty state and the
            // catalog keeps whatever selection it had.
            this._markets.set([]);
        } finally {
            this._loading.set(false);
        }
    }

    /**
     * Forces a refetch — the picker's retry after a failed load, and the way to
     * pick up a market an admin added inside the cache window.
     */
    async reload(): Promise<void> {
        this._loaded = false;
        this._clearList();
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

    private _cacheList(markets: Market[]): void {
        try {
            const entry: CachedList = {
                v: LIST_VERSION,
                at: Date.now(),
                markets,
            };
            localStorage.setItem(LIST_KEY, JSON.stringify(entry));
        } catch {
            // Caching is a convenience; the session still works without it.
        }
    }

    /**
     * The cached list, or `null` when there is none, it is stale, it was written
     * under an older shape, or it holds nothing — an empty list would leave the
     * picker permanently blank, which is worth one request to rule out.
     */
    private _restoreList(): Market[] | null {
        try {
            const stored = localStorage.getItem(LIST_KEY);
            if (!stored) {
                return null;
            }
            const parsed = JSON.parse(stored) as CachedList | null;
            const age = Date.now() - (parsed?.at ?? NaN);
            if (
                parsed?.v !== LIST_VERSION ||
                !Array.isArray(parsed.markets) ||
                !Number.isFinite(age) ||
                // A clock moved backwards would otherwise freeze the entry in.
                age < 0 ||
                age > LIST_TTL_MS
            ) {
                this._clearList();
                return null;
            }
            const markets = parsed.markets.filter(
                (market) => typeof market?.id === 'string' && market.id !== ''
            );
            return markets.length > 0 ? markets : null;
        } catch {
            return null;
        }
    }

    private _clearList(): void {
        try {
            localStorage.removeItem(LIST_KEY);
        } catch {
            // Ignore — a stale entry is dropped by its TTL anyway.
        }
    }
}
