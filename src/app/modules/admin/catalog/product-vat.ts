/**
 * The VAT rate codes a product may carry (`Product.VatRate`).
 *
 * Not a percentage field: two of the six are Vietnamese invoicing categories
 * rather than rates — `KCT` (không chịu thuế) and `KKKNT` (không phải kê khai,
 * tính nộp, which is what fresh produce resold B2B falls under). The backend
 * accepts exactly these, upper-cased, and rejects anything else with 400.
 *
 * Fresh food is deliberately not uniformly 10%, which is why this is set per
 * product and not once for the platform.
 */
export const PRODUCT_VAT_RATES = ['KCT', 'KKKNT', '0', '5', '8', '10'] as const;

export type ProductVatRate = (typeof PRODUCT_VAT_RATES)[number];

/**
 * The label for a stored code.
 *
 * The numeric ones are rendered as percentages here rather than translated —
 * "8%" is the same in both languages, and a key per number would be six keys
 * that can only ever drift from the number itself.
 */
export function vatRateLabel(
    code: string | null | undefined,
    label: (key: string) => string
): string {
    const normalized = String(code ?? '')
        .trim()
        .toUpperCase();
    if (!normalized) {
        return label('admin.products.vat.notSet');
    }
    if (/^\d+$/.test(normalized)) {
        return `${normalized}%`;
    }
    return (PRODUCT_VAT_RATES as readonly string[]).includes(normalized)
        ? label(`admin.products.vat.${normalized.toLowerCase()}`)
        : normalized;
}

/**
 * The code itself, for a table cell — `KCT`, `KKKNT`, `8%`.
 *
 * The full label spells the two categories out ("KKKNT — Không phải kê khai,
 * tính nộp"), which is what a form needs and what a column cannot hold: in a
 * cell it clips to "KKKNT — Không phải…", saying less than the bare code would.
 * The long form travels as the cell's tooltip instead.
 */
export function vatRateShortLabel(
    code: string | null | undefined,
    label: (key: string) => string
): string {
    const normalized = vatRateOf(code);
    if (!normalized) {
        return label('admin.products.vat.notSet');
    }
    return /^\d+$/.test(normalized) ? `${normalized}%` : normalized;
}

/** Reads a row's stored code, normalized — `''` when the product has none. */
export function vatRateOf(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toUpperCase();
}
