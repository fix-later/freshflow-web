/**
 * Models for the storefront landing (`/home`).
 *
 * Everything here is backed by a real endpoint. The file used to carry a second
 * group of stubbed records marked `source: 'stub'`; those went with the two
 * sections that consumed them (see the note at the end).
 *
 * See the Gap Register in `specs/004-storefront-landing/plan.md`.
 */

/**
 * A product category presented as an area of the market. The buyer is picking
 * an aisle to walk into, not filtering a taxonomy.
 */
export interface MarketZone {
    id: string;
    name: string;
    nameEn: string;
    /** `CategoryDto.ImageUrl`; empty when the category has no artwork yet. */
    imageUrl: string;
    /**
     * Products in this category across the catalogue. Not market-scoped: the
     * listing endpoint reports no total. See `CatalogService.categoryCounts`.
     */
    itemCount: number;
}

/** A market together with what it is known for. */
export interface MarketStrength {
    id: string;
    name: string;
    address: string;
    imageUrl: string;
    /** The market's own description. Empty means no speciality line is shown. */
    specialty: string;
    /** True for the market currently being shopped. */
    isSelected: boolean;
}

/**
 * The order deadline, derived from `OrdersService.getOrderingWindow()`.
 *
 * `known: false` is load-bearing — when the window cannot be read, the section
 * shows no time at all rather than a default. A wrong deadline is worse than no
 * deadline on the one section whose job is telling the buyer when to order.
 */
export interface OrderCutoffView {
    known: boolean;
    isOpen: boolean;
    /** e.g. `22:00`. Empty when unknown. */
    cutoffLabel: string;
    /** Milliseconds until the cut-off; never negative. */
    remainingMs: number;
    /** Days between order and delivery, as the server reports it. */
    deliveryWindowDays: number;
}

// The stubbed `BusinessKind` / `RecommendedBasket` / `BasketLine` types lived
// here, along with `StorefrontStubService` that supplied their placeholder
// data. Both went with the recommended-basket and "Mai bán gì?" sections —
// every remaining section resolves its data from a real endpoint.
