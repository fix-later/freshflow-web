import { FormBuilder } from '@angular/forms';
import {
    applyServerFieldErrors,
    clearServerErrors,
    fieldErrorKey,
    fieldMaxLength,
    serverError,
} from './form-errors';
import { trimmedMaxLengthValidator } from './validators';

const fb = new FormBuilder();

function form() {
    return fb.group({
        addressLine: fb.control('', [trimmedMaxLengthValidator(5)]),
        phone: fb.control(''),
    });
}

describe('fieldErrorKey', () => {
    it('reports the max-length key and its limit', () => {
        const group = form();
        group.controls.addressLine.setValue('far too long');
        expect(fieldErrorKey(group.controls.addressLine)).toBe(
            'errors.field.maxLength'
        );
        expect(fieldMaxLength(group.controls.addressLine)).toBe(5);
    });

    it('returns nothing for a valid control', () => {
        expect(fieldErrorKey(form().controls.phone)).toBeUndefined();
    });
});

describe('applyServerFieldErrors', () => {
    it('matches PascalCase and dotted field names back to the control', () => {
        const group = form();
        const applied = applyServerFieldErrors(
            group,
            {
                fieldErrors: {
                    '$.AddressLine': 'Must not exceed 200 characters',
                },
            },
            () => 'Không được vượt quá 200 ký tự'
        );
        expect(applied).toBe(true);
        expect(serverError(group.controls.addressLine)).toBe(
            'Không được vượt quá 200 ký tự'
        );
    });

    /**
     * An unmapped rule still reaches the field, but framed as a localized
     * sentence with the backend's words as the detail — handing a Vietnamese
     * user an English sentence as *the* explanation is not an explanation.
     */
    it('frames an unmapped backend message instead of showing it raw', () => {
        const group = form();
        applyServerFieldErrors(
            group,
            { fieldErrors: { phone: 'Some new rule' } },
            (key) => key
        );
        // The stub translator echoes keys, so the template has no placeholders
        // to fill — what matters is that the raw string is not the whole
        // message any more.
        expect(serverError(group.controls.phone)).toBe(
            'errors.field.invalidWithDetail'
        );
    });

    it('reports false when nothing matched, so the caller shows a summary', () => {
        expect(
            applyServerFieldErrors(
                form(),
                { fieldErrors: { unknownField: 'nope' } },
                (key) => key
            )
        ).toBe(false);
        expect(applyServerFieldErrors(form(), undefined, (key) => key)).toBe(
            false
        );
    });
});

describe('clearServerErrors', () => {
    it('drops server errors but keeps client-side ones', () => {
        const group = form();
        group.controls.addressLine.setValue('far too long');
        applyServerFieldErrors(
            group,
            { fieldErrors: { addressLine: 'x' }, status: 400 },
            (key) => key
        );
        clearServerErrors(group);
        expect(serverError(group.controls.addressLine)).toBeUndefined();
        expect(fieldErrorKey(group.controls.addressLine)).toBe(
            'errors.field.maxLength'
        );
    });
});
