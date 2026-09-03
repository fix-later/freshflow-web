import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from 'contract';

/**
 * Prefixes every key this app writes into browser storage carries.
 *
 * `freshflow.` is the current convention; `ff.` and `ffx.` predate it and are
 * still in use (the push device record, the onboarding dismissal).
 */
const APP_KEY_PREFIXES = ['freshflow.', 'ff.', 'ffx.'];

/**
 * Keys that belong to the browser rather than to whoever is signed in, and so
 * survive a sign-out.
 *
 * A keep-list, deliberately, not a delete-list: everything else the app stores
 * is treated as session data, so a key added later is cleared by default rather
 * than quietly following the next person into their session.
 *
 * - `ff.notification.deviceId` identifies this browser as a push target, not a
 *   person; dropping it would open a new device row on every sign-in. The push
 *   *token* is registered against an account and is cleared.
 * - `freshflow.markets` caches the public list of chợ, which is the same list
 *   for everyone and is re-read on its own schedule.
 */
const DEVICE_SCOPED_KEYS = new Set([
    'ff.notification.deviceId',
    'freshflow.markets',
]);

/** Session keys that predate the prefixes and would not be swept otherwise. */
const UNPREFIXED_SESSION_KEYS = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY];

/**
 * Clears everything this browser holds about the session that just ended.
 *
 * Signing out is not a reload, so without this the next person at this browser
 * inherits whatever the last one left behind: the chosen chợ, the assistant
 * transcript, the push token registered to an account that is no longer signed
 * in. Called from {@link AuthService} on sign-out and whenever a stored session
 * turns out to be dead.
 *
 * Storage access itself can throw — a browser with site data blocked, or
 * Safari's private mode — and a sign-out must complete regardless, so every
 * access is guarded.
 */
export function clearSessionData(): void {
    for (const storage of storages()) {
        for (const key of sessionKeys(storage)) {
            try {
                storage.removeItem(key);
            } catch {
                // Nothing to do: the session ends either way.
            }
        }
    }
}

/** The two storages, skipping any the browser does not expose. */
function storages(): Storage[] {
    const found: Storage[] = [];
    try {
        if (typeof localStorage !== 'undefined') {
            found.push(localStorage);
        }
    } catch {
        // Blocked — treat as absent.
    }
    try {
        if (typeof sessionStorage !== 'undefined') {
            found.push(sessionStorage);
        }
    } catch {
        // Blocked — treat as absent.
    }
    return found;
}

/** This app's session keys in `storage`, read before anything is removed. */
function sessionKeys(storage: Storage): string[] {
    const keys: string[] = [];
    try {
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key !== null && isSessionKey(key)) {
                keys.push(key);
            }
        }
    } catch {
        return UNPREFIXED_SESSION_KEYS;
    }
    return keys;
}

function isSessionKey(key: string): boolean {
    if (DEVICE_SCOPED_KEYS.has(key)) {
        return false;
    }
    return (
        UNPREFIXED_SESSION_KEYS.includes(key) ||
        APP_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
    );
}
