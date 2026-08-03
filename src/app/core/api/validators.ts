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

/** Phone: 7–15 digits, optional leading `+` (§6). */
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

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
