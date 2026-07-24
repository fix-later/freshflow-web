import { ResponseError } from 'contract';
import { describeApiError } from './error-codes';

/**
 * The user must see the backend's *specific* reason in their own language, so
 * `describeApiError` localizes field-level detail and known codes, and only
 * falls back to a generic key when the response says nothing usable.
 */
describe('describeApiError', () => {
    // A fake translator: echoes the key so tests can assert which key was used.
    const translate = (key: string): string => `t:${key}`;

    function response(body: unknown, status = 400): Response {
        return new Response(JSON.stringify(body), { status });
    }

    it('localizes each field-level validation detail', async () => {
        const err = new ResponseError(
            response(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'One or more fields failed validation.',
                        details: [
                            {
                                field: 'email',
                                message: 'Must be a valid email address',
                            },
                            {
                                field: 'password',
                                message: 'Must be at least 8 characters',
                            },
                        ],
                    },
                },
                400
            ),
            'failed'
        );
        const message = await describeApiError(err, translate, 'fallback');
        expect(message).toBe(
            't:errors.field.emailInvalid t:errors.field.passwordMinLength'
        );
    });

    it('localizes a known error code when there is no field detail', async () => {
        const err = new ResponseError(
            response(
                { success: false, error: { code: 'EMAIL_ALREADY_EXISTS' } },
                409
            ),
            'failed'
        );
        expect(await describeApiError(err, translate, 'fallback')).toBe(
            't:errors.api.emailAlreadyExists'
        );
    });

    it('localizes a known top-level business-rule message', async () => {
        const err = new ResponseError(
            response(
                {
                    success: false,
                    error: {
                        code: 'BUSINESS_RULE_ERROR',
                        message:
                            'Order cannot be cancelled in its current status',
                    },
                },
                409
            ),
            'failed'
        );
        expect(await describeApiError(err, translate, 'fallback')).toBe(
            't:errors.field.orderNotCancellable'
        );
    });

    it('never shows the raw server string — localizes by status instead', async () => {
        const err = new ResponseError(
            response(
                {
                    success: false,
                    error: {
                        code: 'SOME_UNMAPPED_CODE',
                        message: 'An undocumented English sentence.',
                    },
                },
                403
            ),
            'failed'
        );
        // Unmapped code + unmapped message, but the 403 still says *why*.
        expect(await describeApiError(err, translate, 'my.fallback')).toBe(
            't:errors.api.forbidden'
        );
    });

    it('localizes a bodiless rejection by its HTTP status', async () => {
        const err = new ResponseError(new Response(null, { status: 409 }), 'x');
        expect(await describeApiError(err, translate, 'my.fallback')).toBe(
            't:errors.api.conflict'
        );
    });

    it('reports a network failure for a request that never landed', async () => {
        // fetch throws a TypeError when the server can't be reached.
        expect(
            await describeApiError(
                new TypeError('Failed to fetch'),
                translate,
                'my.fallback'
            )
        ).toBe('t:errors.api.network');
    });

    it('uses the caller key only for a truly unknown error', async () => {
        expect(
            await describeApiError(new Error('boom'), translate, 'my.fallback')
        ).toBe('t:my.fallback');
    });
});
