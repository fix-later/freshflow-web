import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from 'contract';
import { clearSessionData } from './session-storage';

/**
 * Signing out is an in-app navigation, so nothing is dropped on its own. What
 * this browser kept about the session that just ended has to go, or the next
 * person to sign in at this machine inherits it — the chosen chợ, the assistant
 * transcript, a push token registered to somebody else's account.
 */
describe('clearSessionData', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it('clears the tokens', () => {
        localStorage.setItem(ACCESS_TOKEN_KEY, 'jwt');
        localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh');

        clearSessionData();

        expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    });

    it('clears what the last session chose and typed', () => {
        localStorage.setItem('freshflow.selectedMarket', '{"id":"m-1"}');
        localStorage.setItem('freshflow.shortcuts', '[]');
        localStorage.setItem('ff.notification.deviceToken', 'push-token');
        sessionStorage.setItem('freshflow.assistant.session', '{}');
        sessionStorage.setItem('ffx.onboarding.dismissed.u-1', '1');

        clearSessionData();

        expect(localStorage.getItem('freshflow.selectedMarket')).toBeNull();
        expect(localStorage.getItem('freshflow.shortcuts')).toBeNull();
        expect(localStorage.getItem('ff.notification.deviceToken')).toBeNull();
        expect(
            sessionStorage.getItem('freshflow.assistant.session')
        ).toBeNull();
        expect(
            sessionStorage.getItem('ffx.onboarding.dismissed.u-1')
        ).toBeNull();
    });

    // The keep-list: these describe the browser, not the person at it.
    it('keeps the push device id, which is this browser rather than an account', () => {
        localStorage.setItem('ff.notification.deviceId', 'device-1');

        clearSessionData();

        expect(localStorage.getItem('ff.notification.deviceId')).toBe(
            'device-1'
        );
    });

    it('keeps the cached list of chợ, which is the same for everyone', () => {
        localStorage.setItem('freshflow.markets', '[]');

        clearSessionData();

        expect(localStorage.getItem('freshflow.markets')).toBe('[]');
    });

    it('leaves keys this app does not own alone', () => {
        localStorage.setItem('theme', 'dark');
        sessionStorage.setItem('some-other-app.state', 'x');

        clearSessionData();

        expect(localStorage.getItem('theme')).toBe('dark');
        expect(sessionStorage.getItem('some-other-app.state')).toBe('x');
    });

    // A key added later is session data until someone says otherwise: the
    // sweep is a keep-list, so forgetting to register a new key leaks nothing.
    it('clears an app key it has never heard of', () => {
        localStorage.setItem('freshflow.somethingNew', 'x');

        clearSessionData();

        expect(localStorage.getItem('freshflow.somethingNew')).toBeNull();
    });
});
