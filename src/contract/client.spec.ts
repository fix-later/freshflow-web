import { clearTokens, setSignInPrompt } from './auth';
import { apiConfiguration, UnauthorizedError } from './client';

/**
 * Guest 401 handling: navigation-driven browsing (GET) must fail silently —
 * pages render empty states — while real actions (mutations) prompt the
 * quick sign-in popup.
 */
describe('contract errorMiddleware — guest 401 handling', () => {
    const middleware = apiConfiguration.middleware[0];
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
