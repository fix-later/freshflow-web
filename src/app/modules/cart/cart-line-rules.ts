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

/** Fewest units the server will accept on this line. Never below 1. */
export function minQuantity(line: DraftOrderLine): number {
    return Math.max(1, line.product.minimumOrderQuantity);
}

/**
 * Most units the listing can supply, or `null` when it reports no figure — an
 * absent stock count is "unknown", not "none", so it must not cap anything.
 */
export function maxQuantity(line: DraftOrderLine): number | null {
    const available = line.product.quantity;
    return typeof available === 'number' && Number.isFinite(available)
        ? available
        : null;
}

/** True when `+` would push the line past what the listing has. */
export function canIncrease(line: DraftOrderLine): boolean {
    const max = maxQuantity(line);
    return max === null || line.quantity < max;
}

/**
 * True when `−` would leave a line the server still accepts. At the minimum the
 * step down is refused rather than silently deleting the line — removal is the
 * bin button's job, and a stepper that empties the row is a different action
 * than the one the user asked for.
 */
export function canDecrease(line: DraftOrderLine): boolean {
    return line.quantity > minQuantity(line);
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
