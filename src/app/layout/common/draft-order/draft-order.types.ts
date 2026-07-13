import { CatalogProduct } from 'app/modules/catalog/catalog.types';

/** One line of the restaurant's in-progress draft order (PRD M5 · FR-ORD). */
export interface DraftOrderLine {
    product: CatalogProduct;
    quantity: number;
    /** Demo display price (VND / unit). Final price locks at confirmation. */
    unitPrice: number;
}
