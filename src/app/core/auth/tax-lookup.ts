/**
 * Free public business-registry lookup (vietqr.io, no SLA) — used at sign-up to auto-fill
 * `restaurantName` from a Vietnamese tax code (MST) so the user doesn't retype it. Mirrors
 * `freshflow-app/src/services/taxLookup.ts` (mobile) exactly, same endpoint/response shape.
 *
 * Callers must treat a `null` result as "couldn't verify", not "invalid" — always allow
 * manual entry to proceed regardless of lookup outcome.
 */
export interface TaxInfo {
    name: string;
    address: string;
    shortName?: string;
}

/**
 * Digit-only length of a tax code, ignoring any `-` the user already typed (the sign-up
 * field accepts free text so `taxCodeValidator` can require the branch-suffix hyphen —
 * see `app/core/api/validators.ts` — but the *lookup* trigger only cares about digit
 * count: 10 for a personal MST, 13 for a branch MST, matching the mobile app's trigger).
 */
export function taxCodeDigitCount(raw: string): number {
    return raw.replace(/\D/g, '').length;
}

/**
 * No SLA on the free endpoint means a stalled connection would otherwise hang
 * `taxLookupLoading` forever with no way for the user to recover short of
 * re-editing the field — abort and fall back to manual entry instead.
 */
const LOOKUP_TIMEOUT_MS = 8000;

/**
 * vietqr.io looks codes up by raw digits, not the hyphenated `10+3` form the register API
 * expects (`TAX_CODE_PATTERN` in validators.ts) — strip any hyphen before querying.
 */
export async function fetchTaxInfo(code: string): Promise<TaxInfo | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    try {
        const digits = code.replace(/\D/g, '');
        const res = await fetch(`https://api.vietqr.io/v2/business/${digits}`, {
            signal: controller.signal,
        });
        const json = await res.json();
        if (json?.code === '00' && json?.data) {
            return {
                name: json.data.name ?? '',
                address: json.data.address ?? '',
                shortName: json.data.shortName ?? '',
            };
        }
        return null;
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}
