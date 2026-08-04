import { FormControl } from '@angular/forms';
import {
    isUuid,
    latitudeValidator,
    longitudeValidator,
    nonBlankValidator,
    passwordStrengthValidator,
    phoneNumberValidator,
    trimmedMaxLengthValidator,
    uuidValidator,
} from './validators';

describe('nonBlankValidator', () => {
    it('rejects empty and whitespace-only values', () => {
        expect(nonBlankValidator(new FormControl(''))).toEqual({
            required: true,
        });
        expect(nonBlankValidator(new FormControl('   '))).toEqual({
            required: true,
        });
    });

    it('accepts a non-blank value', () => {
        expect(nonBlankValidator(new FormControl('Phở'))).toBeNull();
    });
});

describe('passwordStrengthValidator', () => {
    it('passes a compliant password', () => {
        expect(
            passwordStrengthValidator(new FormControl('MySecureP@ss1'))
        ).toBeNull();
    });

    it('leaves an empty value to the required validator', () => {
        expect(passwordStrengthValidator(new FormControl(''))).toBeNull();
    });

    it('reports each failing rule granularly', () => {
        // "short" — too short, no uppercase, no digit, no special.
        const errors = passwordStrengthValidator(new FormControl('short'));
        expect(errors?.['passwordStrength']).toEqual({
            minLength: true,
            uppercase: true,
            digit: true,
            special: true,
        });
    });

    it('flags only the missing special character', () => {
        const errors = passwordStrengthValidator(new FormControl('Password1'));
        expect(errors?.['passwordStrength']).toEqual({
            minLength: false,
            uppercase: false,
            digit: false,
            special: true,
        });
    });
});

describe('phoneNumberValidator', () => {
    it('accepts an empty (optional) value', () => {
        expect(phoneNumberValidator(new FormControl(''))).toBeNull();
    });

    it('accepts 7–15 digits with an optional leading +', () => {
        expect(
            phoneNumberValidator(new FormControl('+84901234567'))
        ).toBeNull();
        expect(phoneNumberValidator(new FormControl('0901234'))).toBeNull();
    });

    it('rejects malformed numbers', () => {
        expect(phoneNumberValidator(new FormControl('12-34'))).toEqual({
            phoneNumber: true,
        });
        expect(phoneNumberValidator(new FormControl('123456'))).toEqual({
            phoneNumber: true,
        });
    });
});

describe('trimmedMaxLengthValidator', () => {
    it('measures the trimmed value, not the raw one', () => {
        const validate = trimmedMaxLengthValidator(3);
        expect(validate(new FormControl('  abc  '))).toBeNull();
        expect(validate(new FormControl('abcd'))).toEqual({
            maxlength: { requiredLength: 3, actualLength: 4 },
        });
    });
});

describe('uuidValidator', () => {
    it('accepts a canonical uuid and leaves blanks alone', () => {
        expect(
            uuidValidator(
                new FormControl('3f0c1c9e-5f2a-4a4d-9f1b-2c7d8e9a0b11')
            )
        ).toBeNull();
        expect(uuidValidator(new FormControl(''))).toBeNull();
    });

    it('rejects anything else', () => {
        expect(uuidValidator(new FormControl('not-an-id'))).toEqual({
            uuid: true,
        });
        expect(isUuid('not-an-id')).toBe(false);
    });
});

describe('coordinate validators', () => {
    it('accept an empty value and an in-range coordinate', () => {
        expect(latitudeValidator(new FormControl(null))).toBeNull();
        expect(latitudeValidator(new FormControl(10.77))).toBeNull();
        expect(longitudeValidator(new FormControl(106.69))).toBeNull();
    });

    it('reject a coordinate that is not a place on earth', () => {
        expect(latitudeValidator(new FormControl(91))).toEqual({
            latitude: true,
        });
        expect(longitudeValidator(new FormControl(-181))).toEqual({
            longitude: true,
        });
    });
});
