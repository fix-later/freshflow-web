/**
 * View model for `ff-product-card` — one product tile.
 *
 * Deliberately pre-formatted strings for money and metadata: the card renders,
 * the caller owns locale/currency formatting (which differs between the price
 * board and the catalog). Keeps the tile free of any pricing logic.
 */
export interface ProductCardVm {
    /** Stable key for `track` in the caller's loop. */
    id: string;
    name: string;
    description?: string | null;

    /** Image URL. When absent, `emoji` + `thumbTint` render as the fallback. */
    thumbnail?: string | null;
    emoji?: string | null;
    /** Any CSS background value behind the emoji fallback. */
    thumbTint?: string | null;

    /** Formatted current price, e.g. "24.000 ₫". */
    price: string;
    /** Formatted pre-discount price; renders struck through when present. */
    oldPrice?: string | null;

    /** One quiet line under the name — market, vendor or unit. */
    meta?: string | null;

    /** Small label above the price — typically the product's category. */
    eyebrow?: string | null;

    /** Corner ribbon text (e.g. "Bán chạy"); `badgeClass` tints it. */
    badge?: string | null;
    badgeClass?: string | null;

    /** 0–5; omit to hide the star row. */
    rating?: number | null;

    /**
     * Units the market still lists. `0` renders as out of stock and disables
     * the cart action; `null`/omitted hides the stock line entirely (the
     * listing endpoint does not always report a quantity).
     */
    stock?: number | null;
    /** Unit the `stock` count is expressed in, e.g. "kg". */
    stockUnit?: string | null;

    favorite?: boolean;
    /** Renders the tile muted with an "inactive" note. */
    inactive?: boolean;

    /** `routerLink` target. Omit for a tile that does not navigate. */
    link?: string | string[] | null;
}
