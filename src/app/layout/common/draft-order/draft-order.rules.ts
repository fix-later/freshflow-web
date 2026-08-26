import { CatalogProduct } from 'app/modules/catalog/catalog.types';

/**
 * The quantity rules a market product is bought under, in one place.
 *
 * They live beside the cart service — not in `modules/cart` — because the cart
 * is the *only* write path, and every surface that adds to it (the catalog
 * grid, the product page, Hot Deals, the landing board, the wishlist) goes
 * through the same call. The rules used to be enforced by the cart page's
 * stepper alone, so those other surfaces could push a line past what the
 * listing has: the `+` on the cart row stopped, while pressing "add" on a tile
 * ten times did not.
 *
 * `modules/cart/cart-line-rules.ts` reads these for the line-level checks the
 * cart and checkout show; nothing computes a pack size or a ceiling of its own.
 */

/**
 * The whole-package size a quantity must move in and land on — a market
 * product is only ever picked and shipped by the case ("kiện"), so 1 kg mỗi
 * kiện = 5 means every legal quantity is a multiple of 5.
 *
 * Falls back to 1 for a product carrying no packing code, so a legacy cart line
 * stays editable instead of breaking. New lines cannot reach that state: the
 * tile refuses to add a product with no packing code.
 */
export function packSizeOf(product: CatalogProduct): number {
    const weight = product.packWeightKg;
    return typeof weight === 'number' && weight > 0 ? weight : 1;
}

/**
 * Most units this listing can supply, rounded down to the last whole case it
 * can fill — or `null` when it reports no figure.
 *
 * `null` is "unknown", not "none": a listing that does not track stock must not
 * be capped at zero. The figure read is `quantity` (available), which is stock
 * on hand *minus* what other buyers' open orders hold — the number this buyer
 * can actually be sold.
 */
export function maxQuantityFor(product: CatalogProduct): number | null {
    const available = product.quantity;
    if (typeof available !== 'number' || !Number.isFinite(available)) {
        return null;
    }
    const step = packSizeOf(product);
    return Math.floor(available / step) * step;
}

/**
 * `quantity` cut down to what the listing can supply, in whole cases.
 *
 * Returns `0` when not even one case can be filled — the caller then has
 * nothing to add rather than a line the server would refuse with
 * `INSUFFICIENT_STOCK`.
 */
export function clampToStock(
    product: CatalogProduct,
    quantity: number
): number {
    const max = maxQuantityFor(product);
    if (max === null) {
        return quantity;
    }
    return Math.max(0, Math.min(quantity, max));
}
