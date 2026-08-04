/**
 * Two-way bridge between reactive-form validation and the backend's own
 * rejections, so every failure a user can cause is answered *at the field that
 * caused it* rather than as a generic toast.
 *
 * - {@link fieldErrorKey} localizes a client-side failure (the mirrored rules
 *   in `validators.ts`, which block the request before it is sent).
 * - {@link applyServerFieldErrors} takes the `details: [{ field, message }]`
 *   array the API answers a 400 with (see `readApiError`) and pins each entry
 *   back onto its control, so a rule the client could not have known about
 *   still lands on the right input.
 */
import { AbstractControl, FormGroup, ValidationErrors } from '@angular/forms';
import { ApiErrorInfo, readApiError } from './envelope';
import { API_MESSAGE_TEXT_KEYS } from './error-codes';

/** Angular/`validators.ts` error key → i18n key, in order of specificity. */
const FIELD_ERROR_KEYS: Record<string, string> = {
    required: 'errors.field.required',
    email: 'errors.field.emailInvalid',
    phoneNumber: 'errors.field.phoneInvalid',
    uuid: 'errors.field.uuidInvalid',
    latitude: 'errors.field.latitudeRange',
    longitude: 'errors.field.longitudeRange',
    pickupWindow: 'errors.field.pickupWindow',
    quantityInvalid: 'errors.field.quantityInvalid',
    quantityInteger: 'errors.field.quantityInteger',
    quantityPositive: 'errors.field.quantityPositive',
    amountPositive: 'errors.field.amountPositive',
    quantityNonNegative: 'errors.field.quantityNonNegative',
    quantityTooLarge: 'errors.field.quantityTooLarge',
    dateInvalid: 'errors.field.dateInvalid',
    datePast: 'errors.field.datePast',
    min: 'errors.field.min',
    max: 'errors.field.max',
};

/**
 * The i18n key describing why `control` is invalid, or `undefined` when it is
 * valid. `maxlength` is resolved separately because its message carries the
 * limit — callers pass `errors.maxlength.requiredLength` as a param.
 */
export function fieldErrorKey(
    control: AbstractControl | null | undefined
): string | undefined {
    const errors: ValidationErrors | null | undefined = control?.errors;
    if (!errors) {
        return undefined;
    }
    if (errors['serverError']) {
        return undefined; // rendered verbatim — it is already localized text
    }
    if (errors['maxlength']) {
        return 'errors.field.maxLength';
    }
    for (const key of Object.keys(FIELD_ERROR_KEYS)) {
        if (errors[key]) {
            return FIELD_ERROR_KEYS[key];
        }
    }
    return 'errors.field.invalid';
}

/** The `{max}` interpolation for `errors.field.maxLength`, when it applies. */
export function fieldMaxLength(
    control: AbstractControl | null | undefined
): number | undefined {
    const max = control?.errors?.['maxlength']?.['requiredLength'];
    return typeof max === 'number' ? max : undefined;
}

/** A backend message pinned onto a control by {@link applyServerFieldErrors}. */
export function serverError(
    control: AbstractControl | null | undefined
): string | undefined {
    const message = control?.errors?.['serverError'];
    return typeof message === 'string' ? message : undefined;
}

/**
 * Pins the backend's per-field rejections onto `form`'s controls and reports
 * whether any of them landed.
 *
 * Field names are matched case-insensitively and with the leading path segment
 * dropped, because ASP.NET answers `ProblemDetails.errors` with PascalCase
 * (`AddressLine`) or dotted paths (`$.addressLine`) while the form keys are
 * camelCase. A message with no matching control is left for the caller to show
 * as a summary — returning `false` is the signal to do that.
 *
 * `translate` localizes the documented backend strings (`API_MESSAGE_TEXT_KEYS`);
 * anything unrecognised is shown as sent, since a specific unknown reason still
 * beats a generic one.
 */
export function applyServerFieldErrors(
    form: FormGroup,
    info: ApiErrorInfo | undefined,
    translate: (key: string) => string
): boolean {
    const fieldErrors = info?.fieldErrors;
    if (!fieldErrors) {
        return false;
    }
    const controls = new Map(
        Object.keys(form.controls).map((name) => [name.toLowerCase(), name])
    );
    let applied = false;
    for (const [field, message] of Object.entries(fieldErrors)) {
        const leaf = field.split('.').pop() ?? field;
        const name = controls.get(leaf.toLowerCase());
        const control = name ? form.get(name) : null;
        if (!control) {
            continue;
        }
        const known = API_MESSAGE_TEXT_KEYS[message.trim()];
        control.setErrors({
            ...(control.errors ?? {}),
            serverError: known ? translate(known) : message,
        });
        control.markAsTouched();
        applied = true;
    }
    return applied;
}

/**
 * Reads a failed call and applies its field-level detail to `form` in one step.
 * Resolves the parsed {@link ApiErrorInfo} so the caller can still decide what
 * to show at form level (e.g. a 403 has no field detail at all).
 */
export async function applyApiErrorToForm(
    form: FormGroup,
    err: unknown,
    translate: (key: string) => string
): Promise<{ info: ApiErrorInfo | undefined; handled: boolean }> {
    const info = await readApiError(err);
    return { info, handled: applyServerFieldErrors(form, info, translate) };
}

/**
 * Clears every `serverError` previously pinned by
 * {@link applyServerFieldErrors}, so a resubmit starts from the client-side
 * verdict instead of re-showing a rejection the user has since fixed.
 */
export function clearServerErrors(form: FormGroup): void {
    for (const control of Object.values(form.controls)) {
        if (!control.errors?.['serverError']) {
            continue;
        }
        const { serverError: _removed, ...rest } = control.errors;
        control.setErrors(Object.keys(rest).length ? rest : null);
    }
}
