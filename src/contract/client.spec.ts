import { clearTokens, setSignInPrompt } from './auth';
import { apiConfiguration, UnauthorizedError } from './client';

/**
 * Guest 401 handling: navigation-driven browsing (GET) must fail silently —
 * pages render empty states — while real actions (mutations) prompt the
 * quick sign-in popup.
 */
describe('contract errorMiddleware — guest 401 handling', () => {
    // Located by role, not index — the middleware chain gains entries over time
    // (a no-store `pre` was added ahead of this one).
    const middleware = apiConfiguration.middleware.find((m) => m.post)!;
    let promptCalls = 0;

    const run = (method: string): Promise<Response | void> =>
        middleware.post!({
            fetch: window.fetch.bind(window),
            url: 'http://api.test/api/v1/products',
            init: { method },
            response: new Response('{}', { status: 401 }),
        });

    beforeEach(() => {
        clearTokens(); // guest: no access/refresh token
        promptCalls = 0;
        setSignInPrompt(() => {
            promptCalls++;
            return true;
        });
    });

    afterEach(() => {
        setSignInPrompt(null);
    });

    it('browsing (GET) fails silently without prompting sign-in', async () => {
        await expectAsync(run('GET')).toBeRejectedWithError(
            UnauthorizedError,
            /sign in/i
        );
        expect(promptCalls).toBe(0);
    });

    it('actions (POST) open the sign-in prompt', async () => {
        await expectAsync(run('POST')).toBeRejectedWithError(
            UnauthorizedError,
            /sign in/i
        );
        expect(promptCalls).toBe(1);
    });

    it('actions (DELETE) open the sign-in prompt', async () => {
        await expectAsync(run('DELETE')).toBeRejectedWithError(
            UnauthorizedError,
            /sign in/i
        );
        expect(promptCalls).toBe(1);
    });
});

/**
 * Every request must bypass the HTTP cache: screens re-fetch a list right after
 * mutating it, and a cached answer to that second GET would silently show the
 * pre-mutation data.
 */
describe('contract noCacheMiddleware', () => {
    const pre = apiConfiguration.middleware.find((m) => m.pre)!;

    it('sets cache: no-store while preserving the request', async () => {
        const params = await pre.pre!({
            fetch: window.fetch.bind(window),
            url: 'http://api.test/api/v1/categories',
            init: { method: 'GET', headers: { Accept: 'application/json' } },
        });

        // `pre` is typed `FetchParams | void`; fail loudly rather than assert.
        if (!params) {
            throw new Error('noCacheMiddleware.pre returned nothing');
        }
        expect(params.init.cache).toBe('no-store');
        expect(params.url).toBe('http://api.test/api/v1/categories');
        expect(params.init.method).toBe('GET');
    });

    it('runs before the error middleware', () => {
        const chain = apiConfiguration.middleware;
        expect(chain.findIndex((m) => m.pre)).toBeLessThan(
            chain.findIndex((m) => m.post)
        );
    });
});
