import { Injectable, computed, signal } from '@angular/core';
import { extractList, parseJson } from 'app/core/api/envelope';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { restaurantFavoritesApi } from 'contract';

interface RawRow {
    [key: string]: unknown;
}

/** First numeric value among `keys` on `row`, parsing numeric strings too. */
function num(row: RawRow, keys: string[]): number | null {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === 'number' && !Number.isNaN(value)) {
            return value;
        }
        if (
            typeof value === 'string' &&
            value.trim() !== '' &&
            !Number.isNaN(+value)
        ) {
            return +value;
        }
    }
    return null;
}

/** First non-empty string value among `keys` on `row`. */
function str(row: RawRow, keys: string[]): string {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === 'string' && value.trim() !== '') {
            return value;
        }
    }
    return '';
}

/**
 * Saved products for fast reordering — the B2B equivalent of a consumer
 * wishlist (PRD RC-1: post-paid credit/debt, not a prepaid storefront).
 * Backed by `GET/POST /restaurants/me/favorites` +
 * `DELETE /restaurants/me/favorites/{marketProductId}`. Shared root singleton
 * so the catalog card toggle, the header panel, and the wishlist page all
 * read/write the same state.
 *
 * Note: the backend's OpenAPI spec does not declare a response schema for
 * the favorites GET, so rows are parsed defensively — same convention as
 * `catalog.service.ts` — against the same field names the market-products
 * listing uses, since a favorite is a saved market-product.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
    private readonly _items = signal<CatalogProduct[]>([]);
    private readonly _loaded = signal(false);
    private _loading: Promise<void> | null = null;

    readonly items = this._items.asReadonly();
    readonly loaded = this._loaded.asReadonly();
    readonly count = computed(() => this._items().length);

    /**
     * Open-state of the header favorites drawer. Kept here (not in the
     * component) so the header trigger and the drawer panel — which render in
     * different parts of the layout, decoupled so the header's pin animation
     * can't affect the drawer — share one source of truth.
     */
    private readonly _drawerOpen = signal(false);
    readonly drawerOpen = this._drawerOpen.asReadonly();

    toggleDrawer(): void {
        void this.ensureLoaded();
        this._drawerOpen.update((open) => !open);
    }

    setDrawerOpen(open: boolean): void {
        void this.ensureLoaded();
        this._drawerOpen.set(open);
    }

    closeDrawer(): void {
        this._drawerOpen.set(false);
    }

    isFavorite(marketProductId: string): boolean {
        return this._items().some(
            (item) => item.marketProductId === marketProductId
        );
    }

    /** Loads the saved favorites once; safe to call from multiple entry points. */
    async ensureLoaded(): Promise<void> {
        if (this._loaded()) {
            return;
        }
        if (!this._loading) {
            this._loading = this._load();
        }
        return this._loading;
    }

    private async _load(): Promise<void> {
        try {
            const res =
                await restaurantFavoritesApi.apiV1RestaurantsMeFavoritesGetRaw();
            const rows = extractList<RawRow>(await parseJson(res.raw));
            const items = rows
                .map((row) => this._toFavoriteProduct(row))
                .filter((item): item is CatalogProduct => !!item);
            this._items.set(items);
        } catch {
            this._items.set([]);
        } finally {
            this._loaded.set(true);
        }
    }

    /** Adds/removes `product` from favorites, syncing to the backend. */
    async toggle(product: CatalogProduct): Promise<void> {
        if (this.isFavorite(product.marketProductId)) {
            await this.remove(product.marketProductId);
            return;
        }
        this._items.update((items) => [...items, product]);
        try {
            await restaurantFavoritesApi.apiV1RestaurantsMeFavoritesPost({
                addFavoriteRequest: {
                    marketProductId: product.marketProductId,
                },
            });
        } catch {
            // Revert the optimistic add — the backend rejected it.
            this._items.update((items) =>
                items.filter(
                    (item) => item.marketProductId !== product.marketProductId
                )
            );
        }
    }

    async remove(marketProductId: string): Promise<void> {
        const previous = this._items();
        this._items.set(
            previous.filter((item) => item.marketProductId !== marketProductId)
        );
        try {
            await restaurantFavoritesApi.apiV1RestaurantsMeFavoritesMarketProductIdDelete(
                { marketProductId }
            );
        } catch {
            // Revert — the backend rejected the removal.
            this._items.set(previous);
        }
    }

    /**
     * Maps one favorites-list row onto a display-ready `CatalogProduct`. The
     * favorite is a saved market-product listing, not the full catalog detail
     * (description/images/category live on the base product), so those fields
     * fall back to blanks rather than triggering a second lookup — consistent
     * with keeping this eagerly-loaded service independent of the lazy
     * catalog module (see file header).
     */
    private _toFavoriteProduct(row: RawRow): CatalogProduct | null {
        const marketProductId = str(row, ['marketProductId', 'id']);
        if (!marketProductId) {
            return null;
        }
        const productId = str(row, ['productId']) || marketProductId;
        const marketId = str(row, ['marketId']);
        const name = str(row, ['productName', 'name']);
        const thumbnail = str(row, ['thumbnail', 'imageUrl']);
        const unit = str(row, ['unitName', 'unit']);
        return {
            id: `${productId}:${marketId}`,
            productId,
            marketProductId,
            name,
            nameEn: str(row, ['nameEn']) || name,
            description: '',
            descriptionEn: '',
            categoryId: str(row, ['categoryId']),
            unit,
            unitEn: str(row, ['unitAbbreviation', 'unitEn']) || unit,
            marketId,
            marketSource: str(row, ['marketName', 'marketSource']),
            price: num(row, ['price', 'currentPrice']),
            quantity: num(row, ['availableQuantity', 'quantity']),
            thumbnail,
            images: thumbnail ? [thumbnail] : [],
            active: row['active'] !== false,
        };
    }
}
