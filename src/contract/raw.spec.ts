import { clearAccessToken, setAccessToken } from './auth';
import { rawApi } from './raw';

describe('rawApi', () => {
    afterEach(() => clearAccessToken());

    it('attaches the current bearer token to authenticated escape-hatch calls', async () => {
        setAccessToken('claim-token');
        const fetchSpy = spyOn(window, 'fetch').and.resolveTo(
            new Response('{}', { status: 200 })
        );

        await rawApi.send('/api/v1/orders/order-1/claims', 'POST', {
            amount: 1000,
        });

        const [, init] = fetchSpy.calls.mostRecent().args;
        const headers = new Headers(init?.headers);
        expect(headers.get('Authorization')).toBe('Bearer claim-token');
    });
});
