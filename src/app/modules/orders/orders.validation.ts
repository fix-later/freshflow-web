/**
 * Client-side mirrors of the Orders request-model constraints, so a rejection
 * the backend would answer with a 400/422 is shown at the field first and the
 * request is never sent.
 *
 * Every limit here comes from the OpenAPI request models — nothing is invented:
 *
 * | Model | Rule |
 * |-------|------|
 * | `CreateDraftOrderRequest` | `items` required, `minItems: 1` |
 * | `DraftOrderItemRequest` / `AddOrderItemRequest` | `marketProductId` uuid; `quantity` int32, `exclusiveMinimum: 0` |
 * | `UpdateOrderItemRequest` | `quantity` int32, `exclusiveMinimum: 0` |
 * | `CancelOrderRequest` | `reason` `maxLength: 500` |
 * | `ReorderFromHistoryRequest` | `notes` `maxLength: 500` |
 * | `ReportOrderIssueRequest` | `orderItemId` uuid; `affectedQuantity` number |
 * | `CreateScheduledOrderRequest` | `recurrenceType` + `firstRunAt` required |
 * | `UpdateScheduledOrderRequest` | `notes` `maxLength: 500` |
 */
import { AbstractControl, ValidationErrors } from '@angular/forms';

/** `CancelOrderRequest.reason` and every `notes` field cap at 500. */
export const ORDER_TEXT_MAX_LENGTH = 500;

/** `CreateDraftOrderRequest.items` — `minItems: 1`. */
export const ORDER_MIN_ITEMS = 1;

/**
 * The largest quantity an `int32` line can carry. Not a business limit — the
 * ceiling of the wire type, past which the backend cannot parse the number.
 */
export const ORDER_QUANTITY_MAX = 2147483647;

/**
 * Order line quantity — a whole number strictly greater than zero
 * (`type: integer, format: int32, exclusiveMinimum: 0`).
 *
 * An empty value is left to `Validators.required`, so an optional quantity
 * field (e.g. `UpdateOrderItemRequest.quantity`) can omit it entirely.
 */
export function orderQuantityValidator(
    control: AbstractControl
): ValidationErrors | null {
    const raw = control.value;
    if (raw === null || raw === undefined || raw === '') {
        return null;
    }
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value)) {
        return { quantityInvalid: true };
    }
    if (!Number.isInteger(value)) {
        return { quantityInteger: true };
    }
    if (value <= 0) {
        return { quantityPositive: true };
    }
    if (value > ORDER_QUANTITY_MAX) {
        return { quantityTooLarge: true };
    }
    return null;
}

/**
 * `ReportOrderIssueRequest.affectedQuantity` is a plain `double`, but a
 * negative "how much was wrong" is not a quantity — reject it here rather than
 * letting the report record a figure nobody can act on.
 */
export function affectedQuantityValidator(
    control: AbstractControl
): ValidationErrors | null {
    const raw = control.value;
    if (raw === null || raw === undefined || raw === '') {
        return null;
    }
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value)) {
        return { quantityInvalid: true };
    }
    return value < 0 ? { quantityNonNegative: true } : null;
}

/**
 * `scheduledFor` / `firstRunAt` are `date-time`. A run in the past cannot be
 * scheduled, and the backend answers 422 for it (BR-ORD-3's lead time is the
 * server's to enforce — this only rejects the plainly impossible).
 */
export function futureDateTimeValidator(
    control: AbstractControl
): ValidationErrors | null {
    const raw = control.value;
    if (!raw) {
        return null;
    }
    const date = raw instanceof Date ? raw : new Date(String(raw));
    if (Number.isNaN(date.getTime())) {
        return { dateInvalid: true };
    }
    return date.getTime() <= Date.now() ? { datePast: true } : null;
}
