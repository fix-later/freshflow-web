/**
 * Reactive-form validators that mirror the backend's server-side rules so the
 * UI can block invalid input before a request is ever sent.
 *
 * These reproduce the FluentValidation rules documented in
 * `docs/04-api-design.md` §6 ("mirror them client-side so the front end can
 * block invalid input before submitting"). Keeping them in one place means
 * every password/phone field enforces the same policy the API does.
 */
import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Per-rule breakdown of the password strength policy. Emitted under the
 * `passwordStrength` key so the template can render a live requirement
 * checklist (each `true` is a rule that is still failing).
 */
export interface PasswordStrengthErrors {
    minLength: boolean;
    uppercase: boolean;
    digit: boolean;
    special: boolean;
}

/** Longest email the backend accepts (`email` max 255, §6). */
export const EMAIL_MAX_LENGTH = 255;

/** Longest free-text name the backend accepts (§6 "Must not exceed 255"). */
export const NAME_MAX_LENGTH = 255;

/** `UpdateRestaurantProfileRequest.name` — `minLength 1, maxLength 200`. */
export const RESTAURANT_NAME_MAX_LENGTH = 200;

/** `DeliveryAddressRequest.addressLine` — `minLength 1, maxLength 500`. */
export const ADDRESS_LINE_MAX_LENGTH = 500;

/** Phone: 7–15 digits, optional leading `+` (§6). */
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

/** `AddFavoriteRequest.marketProductId` — `format: uuid`. */
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Required and non-whitespace — FluentValidation `NotEmpty` rejects blank
 * strings, while Angular's `Validators.required` still accepts `"   "`.
 */
export function nonBlankValidator(
    control: AbstractControl
): ValidationErrors | null {
    const value = typeof control.value === 'string' ? control.value : '';
    return value.trim().length === 0 ? { required: true } : null;
}

/**
 * Password strength — min 8 chars, ≥1 uppercase, ≥1 digit, ≥1 special char
 * (anything that is not a letter or digit). Mirrors the API regex
 * `^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$`.
 *
 * Returns a granular `{ passwordStrength: { … } }` map rather than a bare flag
 * so the field can show which requirements are not yet met. Empty values are
 * left to a separate `Validators.required` / {@link nonBlankValidator}.
 */
export function passwordStrengthValidator(
    control: AbstractControl
): ValidationErrors | null {
    const value = typeof control.value === 'string' ? control.value : '';
    if (!value) {
        return null;
    }
    const failing: PasswordStrengthErrors = {
        minLength: value.length < 8,
        uppercase: !/[A-Z]/.test(value),
        digit: !/\d/.test(value),
        special: !/[^A-Za-z0-9]/.test(value),
    };
    return Object.values(failing).some(Boolean)
        ? { passwordStrength: failing }
        : null;
}

/**
 * Phone number — optional, but when present must be 7–15 digits with an
 * optional leading `+`. Emits `{ phoneNumber: true }` on a malformed value.
 */
export function phoneNumberValidator(
    control: AbstractControl
): ValidationErrors | null {
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    if (!value) {
        return null;
    }
    return PHONE_PATTERN.test(value) ? null : { phoneNumber: true };
}

/**
 * Maximum length measured on the **trimmed** value, because that is what the
 * request carries: every form here sends `value.trim()`, so validating the raw
 * string would reject input the backend would have accepted (and vice versa
 * for trailing spaces). Emits Angular's own `maxlength` shape so
 * `mat-error`/`fieldErrorKey` can read `requiredLength`/`actualLength`.
 */
export function trimmedMaxLengthValidator(
    max: number
): (control: AbstractControl) => ValidationErrors | null {
    return (control) => {
        const value = typeof control.value === 'string' ? control.value : '';
        const length = value.trim().length;
        return length > max
            ? { maxlength: { requiredLength: max, actualLength: length } }
            : null;
    };
}

/**
 * UUID — optional, but when present must be a canonical v4-shaped id. Mirrors
 * `format: uuid` on the favorites request: sending anything else answers 400,
 * which as an optimistic toggle would silently revert with no reason shown.
 */
export function uuidValidator(
    control: AbstractControl
): ValidationErrors | null {
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    if (!value) {
        return null;
    }
    return UUID_PATTERN.test(value) ? null : { uuid: true };
}

/** True when `value` is a syntactically valid UUID (non-form callers). */
export function isUuid(value: string | null | undefined): boolean {
    return !!value && UUID_PATTERN.test(value.trim());
}

/**
 * Latitude — optional, but a saved coordinate outside ±90 is not a place on
 * earth, so it is rejected before the address is stored against it.
 */
export function latitudeValidator(
    control: AbstractControl
): ValidationErrors | null {
    return coordinate(control.value, 90) ? null : { latitude: true };
}

/** Longitude — same as {@link latitudeValidator}, bounded at ±180. */
export function longitudeValidator(
    control: AbstractControl
): ValidationErrors | null {
    return coordinate(control.value, 180) ? null : { longitude: true };
}

/** Empty, or a finite number within ±`bound`. */
function coordinate(value: unknown, bound: number): boolean {
    if (value === null || value === undefined || value === '') {
        return true;
    }
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) && Math.abs(num) <= bound;
}
