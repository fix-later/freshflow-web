import { FormControl } from '@angular/forms';
import { passwordStrengthValidator, phoneNumberValidator } from './validators';

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
