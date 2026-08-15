/**
 * The market config sections, shared by the create and the detail page so the
 * two read as the same screen at different points in its life.
 *
 * Order follows how often a section is touched: the market's own details, then
 * the people working it, then what it sells, then the places and vehicles
 * behind that.
 */
export const MARKET_TABS = [
    { index: 0, slug: 'details', label: 'admin.markets.editPage.tabs.details' },
    { index: 1, slug: 'staff', label: 'admin.markets.editPage.tabs.staff' },
    { index: 2, slug: 'pricing', label: 'admin.markets.editPage.tabs.pricing' },
    { index: 3, slug: 'hubs', label: 'admin.markets.editPage.tabs.hubs' },
    {
        index: 4,
        slug: 'vehicles',
        label: 'admin.markets.editPage.tabs.vehicles',
    },
] as const;

/** The `?tab=` value a tab travels under. */
export type MarketTabSlug = (typeof MARKET_TABS)[number]['slug'];

/**
 * The tab a `?tab=` value names, or 0 for anything unrecognised — a hand-typed
 * or stale slug lands on the details tab rather than on a blank panel.
 */
export function marketTabIndexOf(slug: string | null | undefined): number {
    return MARKET_TABS.find((tab) => tab.slug === slug)?.index ?? 0;
}

/** The slug for a tab index, for writing the URL back. */
export function marketTabSlugOf(index: number): MarketTabSlug {
    return (MARKET_TABS.find((tab) => tab.index === index) ?? MARKET_TABS[0])
        .slug;
}

export const MARKET_STAFF_TAB = 1;
export const MARKET_PRODUCTS_TAB = 2;
export const MARKET_HUBS_TAB = 3;
export const MARKET_VEHICLES_TAB = 4;
