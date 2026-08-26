import { clearTokens, getAccessToken, setTokens } from './auth';
import { getValidAccessToken } from './client';

/** A JWT-shaped string whose payload carries `exp`, `secondsFromNow` away. */
function tokenExpiringIn(secondsFromNow: number, marker = 'a'): string {
    const claims = btoa(
        JSON.stringify({
            sub: '00000000-0000-0000-0000-000000000001',
            exp: Math.floor(Date.now() / 1000) + secondsFromNow,
            marker,
        })
    );
    return `header.${claims}.signature`;
}

/**
 * `getValidAccessToken` is what a SignalR connection hands its
 * `accessTokenFactory`. Unlike an HTTP call there is no 401 to react to — the
 * negotiate just fails and every reconnect reuses the same factory — so an
 * expired token has to be exchanged *before* it is handed over.
 */
describe('contract getValidAccessToken', () => {
    afterEach(() => {
        clearTokens();
    });

    it('answers empty for a signed-out visitor, so nothing tries to connect', async () => {
        clearTokens();

        await expectAsync(getValidAccessToken()).toBeResolvedTo('');
    });

    it('hands back a token that is still good, without a round-trip', async () => {
        const token = tokenExpiringIn(3600);
        setTokens(token, 'refresh-1');
        const fetchSpy = spyOn(window, 'fetch');

        await expectAsync(getValidAccessToken()).toBeResolvedTo(token);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('refreshes an expired token and answers the new one', async () => {
        setTokens(tokenExpiringIn(-60, 'stale'), 'refresh-1');
        const fresh = tokenExpiringIn(3600, 'fresh');
        const fetchSpy = spyOn(window, 'fetch').and.resolveTo(
            new Response(
                JSON.stringify({
                    data: { accessToken: fresh, refreshToken: 'refresh-2' },
                })
            )
        );

        await expectAsync(getValidAccessToken()).toBeResolvedTo(fresh);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(getAccessToken()).toBe(fresh);
    });

    it('treats a token inside the expiry skew as already expired', async () => {
        // 10s of life left: long enough to pass a naive `exp > now`, short
        // enough that a negotiate could land after it dies.
        setTokens(tokenExpiringIn(10, 'nearly-stale'), 'refresh-1');
        const fresh = tokenExpiringIn(3600, 'fresh');
        spyOn(window, 'fetch').and.resolveTo(
            new Response(JSON.stringify({ data: { accessToken: fresh } }))
        );

        await expectAsync(getValidAccessToken()).toBeResolvedTo(fresh);
    });

    it('answers empty when the refresh itself fails', async () => {
        setTokens(tokenExpiringIn(-60), 'refresh-1');
        spyOn(window, 'fetch').and.resolveTo(
            new Response('{}', { status: 401 })
        );

        await expectAsync(getValidAccessToken()).toBeResolvedTo('');
    });

    it('passes an opaque (non-JWT) token through rather than discarding it', async () => {
        setTokens('not-a-jwt', 'refresh-1');
        const fetchSpy = spyOn(window, 'fetch');

        await expectAsync(getValidAccessToken()).toBeResolvedTo('not-a-jwt');
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
