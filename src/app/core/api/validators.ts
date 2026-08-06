/**
 * Reactive-form validators that mirror the backend's server-side rules so the
 * UI can block invalid input before a request is ever sent.
 *
 * **Every limit here is read off the FluentValidation validator that actually
 * runs**, not off `docs/04-api-design.md` — the backend's own guide says the
 * design docs predate the code and the code wins. Each constant names its
 * validator so the pair can be re-checked when either side moves; several of
 * these differ from the doc (tax code has a format, `legalName` is 300 not 255,
 * `recipientName` is 200 not 255), and every one of those differences was a
 * request the user could send and the server would reject.
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

/** `RegisterRestaurantCommandValidator.Email` — `MaximumLength(255)`. */
export const EMAIL_MAX_LENGTH = 255;

/** `UpdateMyProfileCommandValidator.FullName` — `MaximumLength(255)`. */
export const NAME_MAX_LENGTH = 255;

/** `UpdateRestaurantProfileCommandValidator.Name` — `NotEmpty().MaximumLength(200)`. */
export const RESTAURANT_NAME_MAX_LENGTH = 200;

/** `UpdateRestaurantProfileCommandValidator.Address` — `MaximumLength(500)`. */
export const RESTAURANT_ADDRESS_MAX_LENGTH = 500;

/** `UpdateRestaurantProfileCommandValidator.ContactPerson` — `MaximumLength(200)`. */
export const CONTACT_PERSON_MAX_LENGTH = 200;

/** `AddDeliveryAddressCommandValidator.AddressLine` — `NotEmpty().MaximumLength(500)`. */
export const ADDRESS_LINE_MAX_LENGTH = 500;

/**
 * `AddDeliveryAddressCommandValidator.RecipientName` — `MaximumLength(200)`.
 * Not the 255 the doc implies: a 201-character recipient answered 400.
 */
export const RECIPIENT_NAME_MAX_LENGTH = 200;

/** Every `Phone` rule pairs its format check with `MaximumLength(20)`. */
export const PHONE_MAX_LENGTH = 20;

/**
 * `AvatarUrl` / `BusinessLicenseUrl` — `MaximumLength(512)` plus an absolute
 * http(s) check. Both are filled from a Cloudinary upload, so the length is the
 * one a hand-edited value can breach.
 */
export const URL_MAX_LENGTH = 512;

/** `UpdateMyTaxProfileCommandValidator.TaxCode` — `MaximumLength(20)`. */
export const TAX_CODE_MAX_LENGTH = 20;

/** `UpdateMyTaxProfileCommandValidator.LegalName` — `NotEmpty().MaximumLength(300)`. */
export const LEGAL_NAME_MAX_LENGTH = 300;

/** `UpdateMyTaxProfileCommandValidator.Address` — `NotEmpty().MaximumLength(256)`. */
export const TAX_ADDRESS_MAX_LENGTH = 256;

/** `UpdateMyTaxProfileCommandValidator.Email` — `EmailAddress().MaximumLength(256)`. */
export const TAX_EMAIL_MAX_LENGTH = 256;

/** Phone: 7–15 digits, optional leading `+` (`PhoneRegex`, shared by 4 validators). */
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

/**
 * Vietnamese tax code — 10 digits, optionally followed by a 3-digit branch
 * suffix (`UpdateMyTaxProfileCommandValidator`: `^\d{10}(-\d{3})?$`).
 */
const TAX_CODE_PATTERN = /^\d{10}(-\d{3})?$/;

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
 * Vietnamese tax code — `1234567890` or `1234567890-001`.
 *
 * The backend rejects anything else with a 400 that names the regex, which is
 * not a thing to hand a user; blocking it here lets the field say what shape is
 * expected. Empty is left to `Validators.required`, since the rule is
 * `NotEmpty().Matches(…)` and the two failures deserve different wording.
 */
export function taxCodeValidator(
    control: AbstractControl
): ValidationErrors | null {
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    if (!value) {
        return null;
    }
    return TAX_CODE_PATTERN.test(value) ? null : { taxCode: true };
}

/**
 * Absolute `http(s)` URL — the `Uri.TryCreate(…, UriKind.Absolute)` check the
 * backend applies to `avatarUrl` and `businessLicenseUrl`. A relative path or a
 * `data:` blob is rejected server-side, so a hand-typed value is caught here.
 */
export function absoluteHttpUrlValidator(
    control: AbstractControl
): ValidationErrors | null {
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    if (!value) {
        return null;
    }
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return { absoluteUrl: true };
    }
    return url.protocol === 'https:' || url.protocol === 'http:'
        ? null
        : { absoluteUrl: true };
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
