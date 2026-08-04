/**
 * The delivery/receiving windows the platform offers, and the conversions
 * between the three shapes they take:
 *
 * - **slot** — `"09:00-11:00"`, what the pickers bind to;
 * - **API times** — `pickupStart` / `pickupEnd` as `HH:mm:ss`, what
 *   `PUT /restaurants/me/profile` stores;
 * - **timestamp** — an order's `scheduledFor`, whose time-of-day is the start
 *   of the slot it was placed for (see `CheckoutComponent._scheduledFor`).
 *
 * One list, used by both `/profile/business` (the restaurant declares when it
 * can receive goods) and `/checkout` (the window it orders into). They have to
 * agree: checkout only offers what the profile says the kitchen can accept, so
 * a slot the profile cannot express would be unreachable.
 */
export const DELIVERY_WINDOWS = [
    '06:00-08:00',
    '09:00-11:00',
    '14:00-16:00',
    '16:00-18:00',
] as const;

export type DeliveryWindow = (typeof DELIVERY_WINDOWS)[number];

/** `"09:00-11:00"` → `"09:00 - 11:00"` for display. */
export function windowLabel(slot: string): string {
    return slot.replace('-', ' - ');
}

/** `"09:00-11:00"` → `["09:00", "11:00"]`. */
export function windowBounds(slot: string): [string, string] {
    const [start = '', end = ''] = slot.split('-');
    return [start, end];
}

/** Pads `HH:mm` to `HH:mm:ss` so times compare lexically. */
function normalize(time: string | null | undefined): string {
    const trimmed = (time ?? '').trim();
    if (!trimmed) {
        return '';
    }
    const parts = trimmed.split(':');
    while (parts.length < 3) {
        parts.push('00');
    }
    return parts.map((part) => part.padStart(2, '0')).join(':');
}

/** `HH:mm:ss` (or `HH:mm`) → `HH:mm`, the form of a slot bound. */
export function toSlotTime(value: string | null | undefined): string {
    return normalize(value).slice(0, 5);
}

/** `HH:mm` → `HH:mm:ss` for the profile request; blank → `null`. */
export function toApiTime(value: string | null | undefined): string | null {
    return normalize(value) || null;
}

/**
 * The windows that fit inside the restaurant's declared receiving hours.
 *
 * An exactly-matching window yields one slot; wider hours (e.g. 06:00–18:00)
 * yield several. Returns every window when the profile declares none — an
 * unconfigured restaurant is not restricted — and also when the declared hours
 * match nothing, since legacy profiles hold free-form times that predate this
 * list and must not leave the picker empty.
 */
export function windowsWithin(
    pickupStart: string | null | undefined,
    pickupEnd: string | null | undefined
): DeliveryWindow[] {
    const from = normalize(pickupStart);
    const to = normalize(pickupEnd);
    if (!from || !to) {
        return [...DELIVERY_WINDOWS];
    }
    const fitting = DELIVERY_WINDOWS.filter((slot) => {
        const [start, end] = windowBounds(slot);
        return normalize(start) >= from && normalize(end) <= to;
    });
    return fitting.length ? fitting : [...DELIVERY_WINDOWS];
}

/** The window whose bounds are exactly these times, if any. */
export function windowFromTimes(
    pickupStart: string | null | undefined,
    pickupEnd: string | null | undefined
): DeliveryWindow | null {
    const from = normalize(pickupStart);
    const to = normalize(pickupEnd);
    return (
        DELIVERY_WINDOWS.find((slot) => {
            const [start, end] = windowBounds(slot);
            return normalize(start) === from && normalize(end) === to;
        }) ?? null
    );
}

/**
 * The window an order was placed for, read back from its `scheduledFor`.
 * Orders carry the *start* of their slot, so this matches on that alone.
 */
export function windowFromTimestamp(
    scheduledFor: string | Date | null | undefined
): DeliveryWindow | null {
    if (!scheduledFor) {
        return null;
    }
    const date =
        scheduledFor instanceof Date ? scheduledFor : new Date(scheduledFor);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes()
    ).padStart(2, '0')}`;
    return (
        DELIVERY_WINDOWS.find((slot) => windowBounds(slot)[0] === time) ?? null
    );
}
