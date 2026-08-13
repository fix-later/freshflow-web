/**
 * The two per-line rules the backend applies while pricing a confirm, decided
 * from what the cart already holds:
 *
 * - `MINIMUM_ORDER_QUANTITY_NOT_MET` — `OrderPricingCalculator` refuses a line
 *   below the product's `MinimumOrderQuantity`;
 * - `INSUFFICIENT_STOCK` — a line above the listing's available quantity.
 *
 * Both live here rather than in either component because the cart and the
 * checkout have to agree: the cart's stepper keeps a line inside the bounds,
 * and the checkout re-checks them before it creates a draft, for a cart that
 * was restored from storage after the listing moved underneath it.
 */
import { DraftOrderLine } from 'app/layout/common/draft-order/draft-order.types';

/** An i18n key plus its interpolation params, for the caller to translate. */
export interface CartLineIssue {
    key: string;
    params: Record<string, string | number>;
}

/**
 * The whole-package size a line's quantity must move in and land on — a
 * market product is only ever picked/shipped by the case ("kiện"), not by
 * the loose kilogram, so 1 kg mỗi kiện = 5 means every legal quantity is a
 * multiple of 5. Falls back to 1 for a line whose product carries no packing
 * code (legacy cart data from before this existed), so it stays editable
 * instead of breaking — new lines can't reach this state; see
 * `product-card.component.ts`'s `canAddToCart()`, which refuses to add a
 * product with no packing code in the first place.
 */
export function packSize(line: DraftOrderLine): number {
    const weight = line.product.packWeightKg;
    return typeof weight === 'number' && weight > 0 ? weight : 1;
}

/** Fewest units the server will accept on this line, rounded up to a whole case. */
export function minQuantity(line: DraftOrderLine): number {
    const step = packSize(line);
    const floor = Math.max(step, line.product.minimumOrderQuantity);
    return Math.ceil(floor / step) * step;
}

/**
 * Most units the listing can supply, rounded down to the last whole case it
 * can fill — or `null` when it reports no figure — an absent stock count is
 * "unknown", not "none", so it must not cap anything.
 */
export function maxQuantity(line: DraftOrderLine): number | null {
    const available = line.product.quantity;
    if (typeof available !== 'number' || !Number.isFinite(available)) {
        return null;
    }
    const step = packSize(line);
    return Math.floor(available / step) * step;
}

/** True when `+` (one more case) would push the line past what the listing has. */
export function canIncrease(line: DraftOrderLine): boolean {
    const max = maxQuantity(line);
    return max === null || line.quantity + packSize(line) <= max;
}

/**
 * True when `−` (one fewer case) would leave a line the server still accepts.
 * At the minimum the step down is refused rather than silently deleting the
 * line — removal is the bin button's job, and a stepper that empties the row
 * is a different action than the one the user asked for.
 */
export function canDecrease(line: DraftOrderLine): boolean {
    return line.quantity - packSize(line) >= minQuantity(line);
}

/**
 * Why this line would be refused, if it would. Reachable even though the
 * stepper bounds both ends: a cart restored from storage can hold a quantity
 * that was legal when it was added and is not any more.
 */
export function cartLineIssues(
    line: DraftOrderLine,
    productName: string
): CartLineIssue[] {
    const issues: CartLineIssue[] = [];
    const minimum = minQuantity(line);
    if (line.quantity < minimum) {
        issues.push({
            key: 'checkout.lineBelowMinimum',
            params: { product: productName, minimum },
        });
    }
    const max = maxQuantity(line);
    if (max !== null && line.quantity > max) {
        issues.push({
            key: 'checkout.lineOverStock',
            params: { product: productName, available: max },
        });
    }
    return issues;
}
