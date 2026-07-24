import { FormControl, FormGroup } from '@angular/forms';
import { pickupWindowValidator } from './pickup-window.validator';

describe('pickupWindowValidator', () => {
    function group(start: string, end: string): FormGroup {
        return new FormGroup(
            {
                pickupStart: new FormControl(start),
                pickupEnd: new FormControl(end),
            },
            { validators: pickupWindowValidator() }
        );
    }

    it('passes when both times are empty', () => {
        expect(group('', '').errors).toBeNull();
    });

    it('passes when end is after start', () => {
        expect(group('08:00', '18:00').errors).toBeNull();
    });

    it('accepts HH:mm:ss values', () => {
        expect(group('08:00:00', '18:00:00').errors).toBeNull();
    });

    it('flags an incomplete window (only one time set)', () => {
        expect(group('08:00', '').errors).toEqual({
            pickupWindow: 'incomplete',
        });
        expect(group('', '18:00').errors).toEqual({
            pickupWindow: 'incomplete',
        });
    });

    it('flags end equal to or before start', () => {
        expect(group('18:00', '08:00').errors).toEqual({
            pickupWindow: 'endBeforeStart',
        });
        expect(group('08:00', '08:00').errors).toEqual({
            pickupWindow: 'endBeforeStart',
        });
    });
});
