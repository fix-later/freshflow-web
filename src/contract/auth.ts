/**
 * Token storage + auth redirect helpers for the generated API client.
 *
 * The access token is kept in `localStorage` under the same key the app's
 * `AuthService` already uses (`accessToken`), so the generated client and the
 * existing Fuse auth flow stay in sync.
 */

/** localStorage key holding the JWT access token. */
export const ACCESS_TOKEN_KEY = 'accessToken';

/** localStorage key holding the (opaque, rotating) refresh token. */
export const REFRESH_TOKEN_KEY = 'refreshToken';

/** Returns the stored access token, or `null` when the user is signed out. */
export function getAccessToken(): string | null {
    if (typeof localStorage === 'undefined') {
        return null;
    }
    return localStorage.getItem(ACCESS_TOKEN_KEY) || null;
}

/** Persists the access token. */
export function setAccessToken(token: string): void {
    if (typeof localStorage === 'undefined') {
        return;
    }
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

/** Removes the access token (e.g. on sign-out or a 401). */
export function clearAccessToken(): void {
    if (typeof localStorage === 'undefined') {
        return;
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
}

/** True when an access token is present. */
export function hasAccessToken(): boolean {
    return getAccessToken() !== null;
}

/** Returns the stored refresh token, or `null`. */
export function getRefreshToken(): string | null {
    if (typeof localStorage === 'undefined') {
        return null;
    }
    return localStorage.getItem(REFRESH_TOKEN_KEY) || null;
}

/** Persists both tokens after a sign-in or a successful refresh rotation. */
export function setTokens(
    accessToken: string,
    refreshToken?: string | null
): void {
    setAccessToken(accessToken);
    if (typeof localStorage === 'undefined') {
        return;
    }
    if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
}

/** Clears both tokens (sign-out, or a refresh that ultimately failed). */
export function clearTokens(): void {
    clearAccessToken();
    if (typeof localStorage === 'undefined') {
        return;
    }
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Route the browser is sent to after an unauthenticated (401) response.
 *
 * Defaults to this app's real auth route (`/sign-in`). The original spec asked
 * for `/login`; override here if the route is renamed.
 */
let loginUrl = '/sign-in';

export function setLoginUrl(url: string): void {
    loginUrl = url;
}

export function getLoginUrl(): string {
    return loginUrl;
}

/** Sends the browser to the login route (no-op outside the browser). */
export function redirectToLogin(): void {
    if (typeof window === 'undefined') {
        return;
    }
    window.location.assign(loginUrl);
}
