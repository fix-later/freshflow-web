import { Injectable, computed, signal } from '@angular/core';
import { extractList, parseJson } from 'app/core/api/envelope';
import { isUuid } from 'app/core/api/validators';
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

    /**
     * The rejection behind the last failed favorites call, or `null`. Kept raw
     * (not a message) so each surface localizes it with its own fallback via
     * `describeApiError` — the service stays DI-free of Transloco.
     */
    private readonly _error = signal<unknown>(null);

    /**
     * Saved products.
     *
     * The "no packing code" listings are dropped in {@link _toFavoriteProduct}
     * instead of here. That has to happen where the raw row is still in hand:
     * on a `CatalogProduct` a missing packing weight and an absent one are both
     * `null`, and filtering that here dropped **every** favourite the server
     * returned — the row simply did not carry the field, so the list emptied
     * itself on each reload and the wishlist looked like it never saved.
     */
    readonly items = this._items.asReadonly();
    readonly loaded = this._loaded.asReadonly();
    readonly error = this._error.asReadonly();
    readonly count = computed(() => this.items().length);

    /** Clears the stored rejection once a surface has shown it. */
    clearError(): void {
        this._error.set(null);
    }

    /** Re-reads the saved favorites, e.g. the retry action on an error state. */
    async reload(): Promise<void> {
        this._loaded.set(false);
        this._loading = null;
        await this.ensureLoaded();
    }

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
        this._error.set(null);
        try {
            const res =
                await restaurantFavoritesApi.apiV1RestaurantsMeFavoritesGetRaw();
            const rows = extractList<RawRow>(await parseJson(res.raw));
            const items = rows
                .map((row) => this._toFavoriteProduct(row))
                .filter((item): item is CatalogProduct => !!item);
            this._items.set(items);
        } catch (err) {
            // A failed read is not an empty list: keep the rejection so the
            // wishlist can say why it is blank and offer a retry.
            this._items.set([]);
            this._error.set(err);
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
        // `marketProductId` is `format: uuid` on AddFavoriteRequest. Anything
        // else answers 400, which as an optimistic toggle would flicker on and
        // silently off again — reject it here instead.
        if (!isUuid(product.marketProductId)) {
            this._error.set(new Error('INVALID_MARKET_PRODUCT_ID'));
            return;
        }
        this._error.set(null);
        this._items.update((items) => [...items, product]);
        try {
            await restaurantFavoritesApi.apiV1RestaurantsMeFavoritesPost({
                addFavoriteRequest: {
                    marketProductId: product.marketProductId,
                },
            });
        } catch (err) {
            // Revert the optimistic add — the backend rejected it — and keep
            // the reason so the surface can explain the disappearing heart.
            this._items.update((items) =>
                items.filter(
                    (item) => item.marketProductId !== product.marketProductId
                )
            );
            this._error.set(err);
        }
    }

    async remove(marketProductId: string): Promise<void> {
        this._error.set(null);
        const previous = this._items();
        this._items.set(
            previous.filter((item) => item.marketProductId !== marketProductId)
        );
        try {
            await restaurantFavoritesApi.apiV1RestaurantsMeFavoritesMarketProductIdDelete(
                { marketProductId }
            );
        } catch (err) {
            // Revert — the backend rejected the removal.
            this._items.set(previous);
            this._error.set(err);
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
            // Favourites rows may omit category; blank keeps the tile usable
            // until the catalog listing supplies the real label.
            categoryLabel: str(row, [
                'category',
                'categoryName',
                'categoryLabel',
            ]),
            unit,
            unitEn: str(row, ['unitAbbreviation', 'unitEn']) || unit,
            unitShort: str(row, ['unitAbbreviation']) || unit,
            marketId,
            marketSource: str(row, ['marketName', 'marketSource']),
            price: num(row, ['price', 'currentPrice']),
            quantity: num(row, ['availableQuantity', 'quantity']),
            totalQuantity: num(row, ['currentQuantity', 'quantity']),
            // `FavoriteItemDto` carries no packing weight today, so this is
            // normally null and the surfaces treat that as "not stated" rather
            // than "no packing code" (see `favorites-drawer.unavailableLabel`).
            // Read anyway, in both the shapes the listing endpoints use, so the
            // day the DTO gains the field the wishlist picks it up unchanged.
            packWeightKg:
                num(row, ['packingWeightKg', 'packWeightKg', 'capacityKg']) ??
                (row['sellingUnit'] && typeof row['sellingUnit'] === 'object'
                    ? num(row['sellingUnit'] as RawRow, [
                          'weightKg',
                          'capacityKg',
                      ])
                    : null),
            updatedAt: str(row, ['updatedAt']),
            // The favourites row does not carry it (see the note above about
            // base-product fields); 1 is the backend's own default, so a line
            // added from here is bounded by the cart's stock rule alone until
            // the catalog fills the real figure in.
            minimumOrderQuantity: Math.max(
                1,
                num(row, ['minimumOrderQuantity']) ?? 1
            ),
            thumbnail,
            images: thumbnail ? [thumbnail] : [],
            active: row['active'] !== false,
            // Not carried by the favourites row (see the note above about
            // base-product fields), and unread on this surface. The catalog
            // listing is what supplies tags when a tile is rendered from there.
            tags: [],
            featured: false,
        };
    }
}
