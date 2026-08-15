/**
 * An entry in the global tag catalog (`GET /api/v1/tags`, `TagDto`).
 *
 * Tags used to be free-form strings stored on the listing, with one magic name
 * (`nổi bật`) meaning "pinned". SCRUM-386 replaced that with this shared
 * catalog: a listing now references catalog tags **by id**, and pinning is
 * {@link pinsToTop} on the tag itself rather than a name anyone could typo.
 */
export interface CatalogTag {
    id: string;
    /** Trimmed + lower-cased by the server (`Tag.NormalizeName`); unique. */
    name: string;
    /** Any listing carrying this tag sorts to the top of the market board. */
    pinsToTop: boolean;
}

/** `SetMarketProductTagsCommandValidator` — at most 8 tags per listing. */
export const MAX_MARKET_PRODUCT_TAGS = 8;

/** `Tag.MaxNameLength` — per-tag character cap the domain enforces. */
export const MAX_TAG_NAME_LENGTH = 30;

/**
 * Applies the backend's tag-name normalisation (`Tag.NormalizeName`): trim,
 * lower-case, drop empties, de-duplicate — order preserved.
 *
 * Still needed even though writes now send ids: the storefront's `?tag=` filter
 * travels by **name** (a shareable URL of guids would be unreadable), so the
 * names in the query string have to be folded the same way the server folded
 * them before they can be compared. `toLowerCase()` rather than a locale-aware
 * fold, because the backend uses `ToLowerInvariant`.
 */
export function normalizeTagNames(names: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of names) {
        const name = raw.trim().toLowerCase();
        if (name && !seen.has(name)) {
            seen.add(name);
            out.push(name);
        }
    }
    return out;
}

export interface CatalogCategory {
    id: string;
    name: string;
    nameEn: string;
    slug: string;
    icon: string;
    /** `CategoryDto.ImageUrl` — empty when the category has no artwork yet. */
    imageUrl: string;
    /** Empty / null = root (parent) category. */
    parentId: string | null;
}

// The price-history point type used to live here. It moved to
// `CatalogAdminService` (`PriceHistoryEntry`) with the feature: recorded price
// changes are an operational record for Admin ▸ Markets ▸ Pricing, not part of
// what the storefront tells a buyer about a listing.

/** One market's listing of a product — the unit the catalog grid renders. */
export interface CatalogProduct {
    /** Unique per listing (`productId:marketId`) — a product sold by two markets is two rows. */
    id: string;
    productId: string;
    /** The market's listing row id — what favorites/analytics APIs key on. */
    marketProductId: string;
    name: string;
    nameEn: string;
    description: string;
    descriptionEn: string;
    categoryId: string;
    /**
     * Category display name from the listing row (`category` string on
     * `GET /markets/{id}/products`). Used when `categoryId` is absent or the
     * categories tree has not loaded yet.
     */
    categoryLabel: string;
    unit: string;
    unitEn: string;
    /**
     * Short form of the unit (`ProductDto.UnitAbbreviation`, e.g. "kg"), for
     * places the full name would crowd the layout — a price denominator
     * ("130.000 ₫/kg") or a stock count. Falls back to {@link unit}.
     */
    unitShort: string;
    marketId: string;
    marketSource: string;
    price: number | null;
    /**
     * `availableQuantity` — stock on hand **minus** what open orders have
     * reserved. This is what a buyer can actually order, and the only quantity
     * the storefront shows.
     */
    quantity: number | null;
    /**
     * `currentQuantity` — stock on hand before reservations. Greater than
     * {@link quantity} whenever other buyers hold some; kept so a surface that
     * needs the gap (admin, reservation warnings) has it without a second read.
     */
    totalQuantity: number | null;
    /**
     * `sellingUnit.weightKg` — how many kilograms one selling unit weighs
     * (`ProductDto.CapacityKg`, via the listing's packing code). Null when the
     * product carries no packing code.
     */
    packWeightKg: number | null;
    /**
     * `updatedAt` — when this market last restated the price or quantity. On a
     * fresh-produce board that is part of the offer: a price from three days
     * ago is a different claim from one restated this morning.
     */
    updatedAt: string;
    /**
     * `ProductDto.MinimumOrderQuantity` — the floor `OrderPricingCalculator`
     * enforces when the order is confirmed (`MINIMUM_ORDER_QUANTITY_NOT_MET`).
     * Defaults to 1 on the backend, so a listing that omits it is unrestricted.
     */
    minimumOrderQuantity: number;
    thumbnail: string;
    imageUrl?: string;
    images: string[];
    active: boolean;
    /**
     * Catalog tags assigned to this listing (`MarketProductItemDto.Tags`,
     * projected from the shared tag catalog — at most
     * {@link MAX_MARKET_PRODUCT_TAGS} of them).
     *
     * Objects, not strings: the wire shape is `{ id, name, pinsToTop }` since
     * SCRUM-386, and the `pinsToTop` flag is the only thing that decides
     * pinning now.
     */
    tags: CatalogTag[];
    /**
     * Whether any of {@link tags} pins to top — the market flagged this listing
     * as a signature item. Derived, not a field of its own; kept because "is
     * this pinned" is asked all over the storefront (Hot Deals menu, the tile's
     * badge, the catalog filter) and spelling the lookup at each site invites
     * one of them to drift.
     */
    featured: boolean;
}

/**
 * Whether a listing is worth showing a buyer — which is to say, whether it can
 * be ordered at all.
 *
 * Goods move by the case: adding a line seeds one whole case
 * (`DraftOrderService.add`), and every legal quantity is a multiple of it
 * (`cart-line-rules.ts`). Three states fail that, and each is hidden rather
 * than shown as a tile whose button cannot be pressed:
 *
 * - **sold out** (`quantity` 0);
 * - **under one case** — not a smaller offer, but no offer;
 * - **no packing code** (`packWeightKg` absent), which has no case to sell by
 *   at all. The listing is a catalog gap rather than something a buyer can act
 *   on, so it waits out of sight until an admin gives the product a code.
 *
 * An **unreported** quantity (`null`) still shows: it means the market did not
 * state a figure, not that it has none.
 */
export function isOrderableListing(product: CatalogProduct): boolean {
    const pack = product.packWeightKg;
    if (pack === null || pack === undefined || pack <= 0) {
        return false;
    }
    const stock = product.quantity;
    if (stock === null || stock === undefined) {
        return true;
    }
    return stock > 0 && stock >= pack;
}
