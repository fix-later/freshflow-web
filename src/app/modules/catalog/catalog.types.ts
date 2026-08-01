export interface CatalogCategory {
    id: string;
    name: string;
    nameEn: string;
    slug: string;
    icon: string;
    /** Empty / null = root (parent) category. */
    parentId: string | null;
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
    thumbnail: string;
    images: string[];
    active: boolean;
}
