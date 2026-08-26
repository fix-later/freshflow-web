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
 *
 * The pack size and the stock ceiling themselves come from
 * `draft-order.rules.ts`, which `DraftOrderService` enforces on every write —
 * these are the line-level *messages*, not a second copy of the rule.
 */
import {
    maxQuantityFor,
    packSizeOf,
} from 'app/layout/common/draft-order/draft-order.rules';
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
    return packSizeOf(line.product);
}

/**
 * The line's quantity expressed in whole cases — what the buyer actually
 * chose, and what one press of the stepper moves by.
 *
 * Quantity is *stored and sent* in kilograms, because that is what the backend
 * prices and reserves; nothing about this changes the wire format. But kilos
 * are the wrong thing to show beside a `+`: a line reading "15" that jumps to
 * "20" on one press looks broken, where "3" going to "4" is the action that was
 * taken. The kilos remain visible as "5 kg mỗi kiện" under the stepper, which
 * is what ties the two figures together.
 *
 * Not rounded: a legacy line whose quantity is not a whole number of cases is
 * shown as the fraction it is, rather than being quietly restated as a count it
 * does not have. `packSize` falls back to 1, so a line with no packing code
 * keeps showing its kilograms.
 */
export function caseCount(line: DraftOrderLine): number {
    return line.quantity / packSize(line);
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
    return maxQuantityFor(line.product);
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
