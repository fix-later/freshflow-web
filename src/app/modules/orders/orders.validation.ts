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
 * `OrderIssue.MaxDescriptionLength` — 1000, not the 500 every other free-text
 * order field uses. Capping it at 500 here rejected reports the server would
 * have accepted.
 */
export const ORDER_ISSUE_DESCRIPTION_MAX_LENGTH = 1000;

/**
 * `ReportOrderIssueCommandHandler` rejects `AffectedQuantity <= 0` outright
 * (`INVALID_ISSUE_QUANTITY`) — zero is not "how much was wrong", it is no
 * report at all. The handler's second quantity rule, "cannot exceed the ordered
 * item quantity", needs the line being reported on: see
 * {@link maxAffectedQuantityValidator}.
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
    return value <= 0 ? { quantityPositive: true } : null;
}

/**
 * Caps the reported quantity at the line's ordered quantity, the rule the
 * handler applies once `orderItemId` is set. `limit` is read at validation time
 * so the same validator follows the line the user picks; a `null` limit means
 * "whole order", which the handler does not bound.
 */
export function maxAffectedQuantityValidator(
    limit: () => number | null
): (control: AbstractControl) => ValidationErrors | null {
    return (control) => {
        const max = limit();
        const raw = control.value;
        if (max === null || raw === null || raw === undefined || raw === '') {
            return null;
        }
        const value = typeof raw === 'number' ? raw : Number(raw);
        return Number.isFinite(value) && value > max
            ? { maxValue: { max } }
            : null;
    };
}

/**
 * `FileClaimCommandValidator.Amount` — `GreaterThan(0m)`. Money, so a decimal
 * is fine; only the sign and the finiteness are the rule.
 */
export function claimAmountValidator(
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
    return value <= 0 ? { amountPositive: true } : null;
}

/**
 * "Claim amount cannot exceed the amount charged for the order" — the
 * handler's second rule (`INVALID_CLAIM_AMOUNT`). `limit` is read lazily so the
 * validator follows the order once it has loaded; a `null` total means the
 * ceiling is not known yet and only the server can judge it.
 */
export function maxClaimAmountValidator(
    limit: () => number | null
): (control: AbstractControl) => ValidationErrors | null {
    return (control) => {
        const max = limit();
        const raw = control.value;
        if (max === null || raw === null || raw === undefined || raw === '') {
            return null;
        }
        const value = typeof raw === 'number' ? raw : Number(raw);
        return Number.isFinite(value) && value > max
            ? { maxValue: { max } }
            : null;
    };
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
