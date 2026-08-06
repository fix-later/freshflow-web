export interface CatalogCategory {
    id: string;
    name: string;
    nameEn: string;
    slug: string;
    icon: string;
    /** Empty / null = root (parent) category. */
    parentId: string | null;
}

/**
 * One recorded price for a market listing
 * (`GET /markets/{marketId}/products/{productId}/price-history`).
 */
export interface PricePoint {
    recordedAt: string;
    price: number;
}

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
    unit: string;
    unitEn: string;
    marketId: string;
    marketSource: string;
    price: number | null;
    quantity: number | null;
    /**
     * `ProductDto.MinimumOrderQuantity` — the floor `OrderPricingCalculator`
     * enforces when the order is confirmed (`MINIMUM_ORDER_QUANTITY_NOT_MET`).
     * Defaults to 1 on the backend, so a listing that omits it is unrestricted.
     */
    minimumOrderQuantity: number;
    thumbnail: string;
    images: string[];
    active: boolean;
}
