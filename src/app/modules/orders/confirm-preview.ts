import { OrderConfirmPreview, PreviewIssue } from './orders.types';

/**
 * Parses `GET /orders/{orderId}/confirm-preview`. The live body is
 *
 * ```json
 * { "wouldSucceed": true, "issues": [], "totalAmount": 110000,
 *   "resolvedScheduledFor": "2026-08-06T05:59:40.433Z",
 *   "remainingCreditAfter": 790000 }
 * ```
 *
 * The live names lead each list; the rest are tolerated aliases. They used to
 * be absent entirely, so the verdict always fell through to the "can't
 * interpret it" default and the gate never fired — a refusal reached the buyer
 * as a generic failure on confirm instead of a specific reason before it.
 *
 * Read tolerantly on purpose: a body we cannot interpret yields
 * `canConfirm: true` so the confirm still runs and the server stays the
 * authority. The preview explains a refusal early; it never invents one.
 */
export function parseConfirmPreview(
    body: Record<string, unknown> | null | undefined
): OrderConfirmPreview {
    const data = body ?? {};
    const verdict = firstOf(data, [
        'wouldSucceed',
        'canConfirm',
        'isValid',
        'canPlace',
        'isConfirmable',
    ]);
    return {
        canConfirm: verdict !== false,
        blockers: issueList(data, [
            'issues',
            'blockers',
            'errors',
            'reasons',
            'violations',
            'warnings',
        ]),
        totalAmount: firstNumber(data, ['totalAmount', 'total', 'grandTotal']),
        availableCredit: firstNumber(data, [
            'remainingCreditAfter',
            'availableCredit',
            'remainingCredit',
            'creditAvailable',
        ]),
        resolvedScheduledFor: firstString(data, [
            'resolvedScheduledFor',
            'scheduledFor',
        ]),
        subtotal: firstNumber(data, ['subtotalAmount', 'subtotal']),
        deliveryFee: firstNumber(data, ['deliveryFee', 'shippingFee']),
        deliveryDistanceKm: firstNumber(data, [
            'deliveryDistanceKm',
            'distanceKm',
        ]),
        vatAmount: firstNumber(data, ['vatAmount', 'taxAmount']),
    };
}

function firstOf(data: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
        if (data[key] != null) {
            return data[key];
        }
    }
    return null;
}

function firstString(
    data: Record<string, unknown>,
    keys: string[]
): string | null {
    const value = firstOf(data, keys);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstNumber(
    data: Record<string, unknown>,
    keys: string[]
): number | null {
    const value = firstOf(data, keys);
    const parsed = Number(value);
    return value != null && Number.isFinite(parsed) ? parsed : null;
}

/**
 * The live shape is `PreviewIssueDto(Code, Message)` — an object, and the
 * message is the backend's English. Keeping **both** halves is what lets the
 * caller localize: the code resolves through the same map as any rejection, and
 * the message is only the last resort. Plain strings are still accepted, since
 * older bodies sent bare codes.
 */
function issueList(
    data: Record<string, unknown>,
    keys: string[]
): PreviewIssue[] {
    for (const key of keys) {
        const value = data[key];
        if (Array.isArray(value) && value.length) {
            return value
                .map((entry): PreviewIssue => {
                    if (typeof entry === 'string') {
                        // A bare string is a code when it looks like one, and a
                        // message otherwise.
                        return /^[A-Z][A-Z0-9_]*$/.test(entry)
                            ? { code: entry, message: null }
                            : { code: null, message: entry };
                    }
                    const record = (entry ?? {}) as Record<string, unknown>;
                    return {
                        code:
                            typeof record['code'] === 'string'
                                ? record['code']
                                : null,
                        message:
                            typeof record['message'] === 'string'
                                ? record['message']
                                : null,
                    };
                })
                .filter((issue) => !!(issue.code || issue.message));
        }
    }
    return [];
}
