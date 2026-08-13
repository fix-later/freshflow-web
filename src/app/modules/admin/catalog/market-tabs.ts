/**
 * The market config sections, shared by the create and the detail page so the
 * two read as the same screen at different points in its life.
 *
 * Order follows how often a section is touched: the market's own details, then
 * the people working it, then what it sells, then the places and vehicles
 * behind that.
 */
export const MARKET_TABS = [
    { index: 0, label: 'admin.markets.editPage.tabs.details' },
    { index: 1, label: 'admin.markets.editPage.tabs.staff' },
    { index: 2, label: 'admin.markets.editPage.tabs.pricing' },
    { index: 3, label: 'admin.markets.editPage.tabs.hubs' },
    { index: 4, label: 'admin.markets.editPage.tabs.vehicles' },
] as const;

export const MARKET_STAFF_TAB = 1;
export const MARKET_PRODUCTS_TAB = 2;
export const MARKET_HUBS_TAB = 3;
export const MARKET_VEHICLES_TAB = 4;
