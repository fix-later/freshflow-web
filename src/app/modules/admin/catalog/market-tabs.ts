/**
 * The market config sections, shared by the create and the detail page so the
 * two read as the same screen at different points in its life.
 */
export const MARKET_TABS = [
    { index: 0, label: 'admin.markets.editPage.tabs.details' },
    { index: 1, label: 'admin.markets.editPage.tabs.hubs' },
    { index: 2, label: 'admin.markets.editPage.tabs.vehicles' },
    { index: 3, label: 'admin.markets.editPage.tabs.drivers' },
    { index: 4, label: 'admin.markets.editPage.tabs.pricing' },
] as const;

export const MARKET_HUBS_TAB = 1;
export const MARKET_VEHICLES_TAB = 2;
export const MARKET_DRIVERS_TAB = 3;
export const MARKET_PRODUCTS_TAB = 4;
