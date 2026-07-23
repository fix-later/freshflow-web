import { PermissionError, ResponseError } from 'contract';
import { apiErrorMessage, withId } from './envelope';

/**
 * Every screen feeds `row.id` into a path parameter, so a row that arrives
 * without one produces requests like `DELETE /hubs/undefined` — or, worse, an
 * edit that falls through to create and duplicates the record.
 */
describe('withId', () => {
    it('keeps an existing id', () => {
        expect(withId([{ id: 'a', name: 'A' }])).toEqual([
            { id: 'a', name: 'A' },
        ]);
    });

    it('reads the id from a resource-specific alternate key', () => {
        const rows = withId([{ hubId: 'h1', name: 'Hub' }], 'hubId');
        expect(rows[0].id).toBe('h1');
        // The original key is preserved — callers may still read it.
        expect(rows[0]['hubId']).toBe('h1');
    });

    it('prefers id over the alternates', () => {
        const rows = withId([{ id: 'real', hubId: 'other' }], 'hubId');
        expect(rows[0].id).toBe('real');
    });

    it('tries alternates in order', () => {
        const rows = withId(
            [{ deliveryZoneId: 'z9' }],
            'zoneId',
            'deliveryZoneId'
        );
        expect(rows[0].id).toBe('z9');
    });

    it('coerces a non-string id', () => {
        const rows = withId([{ id: 42 }]);
        expect(rows[0].id).toBe('42');
    });

    it('treats blank and nullish keys as absent', () => {
        expect(withId([{ id: '', hubId: 'h1' }], 'hubId')[0].id).toBe('h1');
        expect(withId([{ id: null, hubId: 'h1' }], 'hubId')[0].id).toBe('h1');
        expect(withId([{ id: '   ' }])[0].id).toBe('');
    });

    it('yields an empty id when nothing matches, rather than "undefined"', () => {
        // An empty id is caught by the save guard; the string "undefined" would
        // sail into the URL and hit the API.
        expect(withId([{ name: 'no id here' }])[0].id).toBe('');
    });

    it('does not mutate the input rows', () => {
        const input = [{ hubId: 'h1' }];
        withId(input, 'hubId');
        expect(input[0]).toEqual({ hubId: 'h1' });
    });
});

/**
 * A backend rejection must reach the user with its reason. The reason lives in
 * the response body of either the generated `ResponseError` (4xx) or the typed
 * `ApiError` subclasses the client throws for 401/403/5xx — both must be read.
 */
describe('apiErrorMessage', () => {
    function response(body: unknown, status = 400): Response {
        return new Response(JSON.stringify(body), { status });
    }

    it('reads the ProblemDetails "detail" from a ResponseError', async () => {
        const err = new ResponseError(
            response({ detail: 'Order already batched.' }, 409),
            'failed'
        );
        expect(await apiErrorMessage(err)).toBe('Order already batched.');
    });

    it('reads the reason from a typed PermissionError (403)', async () => {
        const err = new PermissionError(
            response({ detail: 'Restaurant not approved yet.' }, 403)
        );
        expect(await apiErrorMessage(err)).toBe('Restaurant not approved yet.');
    });

    it('joins a validation "errors" map', async () => {
        const err = new ResponseError(
            response({ errors: { name: ['Name is required.'] } }, 422),
            'failed'
        );
        expect(await apiErrorMessage(err)).toBe('Name is required.');
    });

    it('falls back through title/message/error', async () => {
        const err = new ResponseError(response({ title: 'Conflict' }), 'x');
        expect(await apiErrorMessage(err)).toBe('Conflict');
    });

    it('returns undefined for a non-HTTP error', async () => {
        expect(await apiErrorMessage(new Error('boom'))).toBeUndefined();
    });

    it('returns undefined when the body carries no usable message', async () => {
        const err = new ResponseError(response({ foo: 'bar' }), 'x');
        expect(await apiErrorMessage(err)).toBeUndefined();
    });
});
