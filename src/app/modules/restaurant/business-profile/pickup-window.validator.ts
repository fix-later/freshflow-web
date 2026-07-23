import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Cross-field validator for the restaurant receiving/pickup window.
 *
 * Rules (spec FR-003):
 * - both `pickupStart` and `pickupEnd` are provided together, or neither;
 * - when both are set, `pickupEnd` must be strictly after `pickupStart`.
 *
 * Times are the `HH:mm` / `HH:mm:ss` strings the time inputs produce; they are
 * compared lexically, which is order-preserving for zero-padded 24-hour times.
 * Returns `{ pickupWindow: 'incomplete' | 'endBeforeStart' }` on the group, or
 * `null` when valid.
 *
 * @param startKey control name holding the start time (default `pickupStart`)
 * @param endKey   control name holding the end time (default `pickupEnd`)
 */
export function pickupWindowValidator(
    startKey = 'pickupStart',
    endKey = 'pickupEnd'
): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
        const start = (group.get(startKey)?.value ?? '') as string;
        const end = (group.get(endKey)?.value ?? '') as string;

        const hasStart = start.trim() !== '';
        const hasEnd = end.trim() !== '';

        if (!hasStart && !hasEnd) {
            return null;
        }
        if (hasStart !== hasEnd) {
            return { pickupWindow: 'incomplete' };
        }
        if (normalize(end) <= normalize(start)) {
            return { pickupWindow: 'endBeforeStart' };
        }
        return null;
    };
}

/** Pad an `HH:mm` value to `HH:mm:ss` so lexical comparison is well-defined. */
function normalize(time: string): string {
    const parts = time.split(':');
    while (parts.length < 3) {
        parts.push('00');
    }
    return parts.map((p) => p.padStart(2, '0')).join(':');
}
