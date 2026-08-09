import { CatalogProduct } from 'app/modules/catalog/catalog.types';

/**
 * Models for the storefront landing (`/home`).
 *
 * Split deliberately into two groups: what the backend can answer today, and
 * what it cannot. Records in the second group carry `source: 'stub'`, which is
 * a literal type rather than a comment so the marker cannot be dropped silently
 * when a real endpoint arrives, and so every placeholder is greppable.
 *
 * See the Gap Register in `specs/004-storefront-landing/plan.md`.
 */

// ── Real data ────────────────────────────────────────────────────────────────

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
    /** Zone marker shown when there is no artwork, and beside the name. */
    marker: string;
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

// ── Stubbed data (no backend exists) ─────────────────────────────────────────

/** Marks a record whose data is a front-end placeholder, not a system fact. */
export type StubSource = 'stub';

/**
 * A kind of F&B operation. **Stub** — nothing in either repository models a
 * restaurant's cuisine or business type.
 */
export interface BusinessKind {
    id: string;
    name: string;
    nameEn: string;
    marker: string;
    /** A property of the placeholder, not a measurement of anything. */
    ingredientCount: number;
    source: StubSource;
}

/**
 * A set of products one kind of kitchen buys together. **Stub.**
 *
 * Members are held as **product names**, not ids: a hardcoded id is meaningless
 * outside one database, whereas a name can be resolved against whatever catalogue
 * is actually present. Unresolvable members render as unavailable rather than
 * disappearing, so the basket degrades honestly instead of lying.
 */
export interface RecommendedBasket {
    id: string;
    businessKindId: string;
    name: string;
    nameEn: string;
    memberNames: readonly string[];
    source: StubSource;
}

/**
 * One basket member resolved against the selected market. Runtime only — this
 * is never stored or fetched.
 */
export interface BasketLine {
    /** The requested name, shown even when nothing matched it. */
    label: string;
    /** `null` when this market does not list the product. */
    product: CatalogProduct | null;
    quantity: number;
    /** The buyer can drop a line before adding the basket. */
    included: boolean;
    /** Only available lines can enter an order. */
    available: boolean;
}
