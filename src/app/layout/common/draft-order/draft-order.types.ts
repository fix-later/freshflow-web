import { CatalogProduct } from 'app/modules/catalog/catalog.types';

/** One line of the restaurant's in-progress draft order (PRD M5 · FR-ORD). */
export interface DraftOrderLine {
    product: CatalogProduct;
    quantity: number;
    /** Display price (VND / unit). Final price locks at confirmation. */
    unitPrice: number;
    /**
     * `OrderItemDto.orderItemId` once the line exists on the server draft.
     *
     * Absent for a line added while signed out, or in the instant between the
     * optimistic local update and the write landing — the item CRUD routes are
     * keyed by it, so a line without one can only be pushed up by re-reading
     * the draft.
     */
    orderItemId?: string;
}

/** How the local cart and the server-side draft order currently relate. */
export type DraftSyncState =
    /** Signed out — the cart is local only and no draft exists yet. */
    | 'local'
    /** Reading the existing draft back (page load, sign-in). */
    | 'loading'
    /** A write is in flight; the local state is optimistic. */
    | 'saving'
    /** Local state matches the server draft. */
    | 'saved'
    /** The last write failed; `syncError` says why. */
    | 'error';
