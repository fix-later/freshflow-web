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
    imageUrl?: string | null;
    emoji?: string | null;
    /** Any CSS background value behind the emoji fallback. */
    thumbTint?: string | null;

    /** Formatted current price, e.g. "24.000 ₫". */
    price: string;
    /** Formatted pre-discount price; renders struck through when present. */
    oldPrice?: string | null;
    /**
     * What the price is quoted per, short form — "kg", "bó". Renders as the
     * denominator beside the price ("24.000 ₫ / kg"), so a shopper can compare
     * two listings without opening either.
     */
    priceUnit?: string | null;

    /** One quiet line under the name — market, vendor or unit. */
    meta?: string | null;

    /** Small label above the price — typically the product's category. */
    eyebrow?: string | null;

    /**
     * How the goods are packed, pre-formatted — "Thùng 15 kg". Sits with the
     * other trade facts; omit for products sold loose.
     */
    packNote?: string | null;

    /**
     * When the market last restated price/quantity, pre-formatted — "2 giờ
     * trước". On a produce board this qualifies the price itself, so it is
     * shown rather than left for the detail page.
     */
    updatedNote?: string | null;

    /**
     * Corner ribbon text (e.g. "Nổi bật"); `badgeClass` tints it.
     * Tints available: `--featured` (mint, the brand highlight), `--sale`
     * (brand pink), `--amber`, `--blue`, `--rose`. Omit for the primary navy.
     */
    badge?: string | null;
    badgeClass?: string | null;

    /**
     * Free-form labels the market put on the listing (`MarketProduct.Tags`),
     * already display-cased by the caller — the API stores them lower-case.
     *
     * The pinned tag is **not** repeated here: it is the corner `badge`, and
     * showing it twice on one tile reads as two different claims. Rendered as
     * quiet chips, so a market's own vocabulary ("hàng đà lạt", "size lớn")
     * reaches the shopper without competing with the name and price.
     */
    tags?: readonly string[] | null;

    /** 0–5; omit to hide the star row. */
    rating?: number | null;

    /**
     * Units the market still lists. Not rendered as text (a raw kg count told
     * a buyer nothing they could act on, since ordering only ever moves by
     * the case — see {@link packWeightKg}) — `0` still disables the cart
     * action and shows the "out of stock" badge; `null`/omitted means the
     * listing did not report a figure, so nothing is disabled on its account.
     */
    stock?: number | null;
    /** Unit the `stock` count is expressed in, e.g. "kg". Kept for parity with `stock`; no longer displayed. */
    stockUnit?: string | null;
    /**
     * How many kilograms one case ("kiện") of this product weighs
     * (`CatalogProduct.packWeightKg`). A product can only be ordered by the
     * whole case, so `null`/`0` (no packing code configured) disables the
     * cart action the same way being out of stock does — there is no legal
     * quantity to add.
     */
    packWeightKg?: number | null;

    favorite?: boolean;
    /** Renders the tile muted with an "inactive" note. */
    inactive?: boolean;

    /** `routerLink` target. Omit for a tile that does not navigate. */
    link?: string | string[] | null;
}
