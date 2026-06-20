export interface CatalogCategory {
    id: string;
    name: string;
    nameEn: string;
    slug: string;
    icon: string;
}

export interface CatalogProduct {
    id: string;
    name: string;
    nameEn: string;
    description: string;
    descriptionEn: string;
    categoryId: string;
    unit: string;
    unitEn: string;
    marketSource: string;
    thumbnail: string;
    images: string[];
    active: boolean;
}

export interface CatalogPagination {
    length: number;
    size: number;
    page: number;
    lastPage: number;
    startIndex: number;
    endIndex: number;
}
