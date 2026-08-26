/**
 * Singleton configuration for the generated OpenAPI (`typescript-fetch`) client.
 *
 * Responsibilities:
 *  - one shared {@link Configuration} pointed at `environment.apiBaseUrl`
 *  - attach `Authorization: Bearer <token>` whenever a token is in localStorage
 *  - always send `Accept` / `Content-Type: application/json`
 *  - centralised handling of 401 / 403 / 5xx responses
 *
 * Do not edit the generated files in `./generated` — re-run `npm run generate:api`.
 */
import { environment } from '../environments/environment';
import {
    clearTokens,
    getAccessToken,
    getRefreshToken,
    promptSignIn,
    redirectToLogin,
    setTokens,
} from './auth';
import {
    Configuration,
    type FetchParams,
    type Middleware,
    type RequestContext,
    type ResponseContext,
} from './generated';

// -----------------------------------------------------------------------------
// Typed error classes
// -----------------------------------------------------------------------------

/** Base class for errors surfaced by the API client. */
export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly response?: Response
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/** 401 — the request was not authenticated. Token is cleared + redirect issued. */
export class UnauthorizedError extends ApiError {
    constructor(response?: Response) {
        super('Your session has expired. Please sign in again.', 401, response);
        this.name = 'UnauthorizedError';
    }
}

/** 403 — authenticated but not permitted to perform the action. */
export class PermissionError extends ApiError {
    constructor(response?: Response) {
        super(
            'You do not have permission to perform this action.',
            403,
            response
        );
        this.name = 'PermissionError';
    }
}

/** 5xx — generic server-side failure. */
export class ServerError extends ApiError {
    constructor(status: number, response?: Response) {
        super(
            'Something went wrong on the server. Please try again later.',
            status,
            response
        );
        this.name = 'ServerError';
    }
}

// -----------------------------------------------------------------------------
// Silent token refresh (BR-AUTH-5)
// -----------------------------------------------------------------------------

/**
 * Pre-auth endpoints where a 401/4xx is a normal outcome (bad credentials,
 * expired reset token, ...). These must NOT trigger a refresh or a redirect —
 * the caller renders the error instead.
 */
const PRE_AUTH_PATHS = [
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/auth/register',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
];

/** Header used to mark a request that has already been retried once. */
const RETRY_HEADER = 'X-Token-Retry';

let refreshInFlight: Promise<boolean> | null = null;

/** Exchanges the refresh token for a new access/refresh pair (rotation). */
async function refreshTokens(): Promise<boolean> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        return false;
    }
    try {
        const res = await fetch(
            `${environment.apiBaseUrl}/api/v1/auth/refresh`,
            {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshToken }),
            }
        );
        if (!res.ok) {
            return false;
        }
        const body = await res.json();
        const data = body?.data ?? body;
        if (!data?.accessToken) {
            return false;
        }
        setTokens(data.accessToken, data.refreshToken ?? refreshToken);
        return true;
    } catch {
        return false;
    }
}

/** De-duplicates concurrent refreshes so parallel 401s share one round-trip. */
function refreshTokensOnce(): Promise<boolean> {
    refreshInFlight ??= refreshTokens().finally(() => {
        refreshInFlight = null;
    });
    return refreshInFlight;
}

/** Seconds before `exp` at which a token is treated as already expired. */
const TOKEN_EXPIRY_SKEW_SECONDS = 30;

/** `exp` of a JWT in seconds, or `null` when it carries none / is unreadable. */
function tokenExpiry(token: string): number | null {
    const payload = token.split('.')[1];
    if (!payload) {
        return null;
    }
    try {
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const claims: unknown = JSON.parse(json);
        const exp = (claims as { exp?: unknown })?.exp;
        return typeof exp === 'number' ? exp : null;
    } catch {
        return null;
    }
}

/**
 * An access token that will still be accepted, refreshing first when the
 * stored one is at or past its expiry.
 *
 * HTTP calls do not need this — {@link errorMiddleware} refreshes on the 401
 * and retries. A SignalR connection has no such second chance: an expired
 * token fails the negotiate, and the client's reconnects reuse whatever this
 * factory returns, so an expired token would keep failing until the page is
 * reloaded. Returns `''` when signed out, or when the refresh fails — the
 * caller then simply does not connect.
 */
export async function getValidAccessToken(): Promise<string> {
    const token = getAccessToken();
    if (!token) {
        return '';
    }
    const exp = tokenExpiry(token);
    const stillValid =
        exp === null || exp - TOKEN_EXPIRY_SKEW_SECONDS > Date.now() / 1000;
    if (stillValid) {
        return token;
    }
    return (await refreshTokensOnce()) ? getAccessToken() ?? '' : '';
}

// -----------------------------------------------------------------------------
// Freshness middleware
// -----------------------------------------------------------------------------

/**
 * Forces every request past the HTTP cache.
 *
 * Screens re-fetch their list right after a mutation, and those two GETs share
 * a URL. Left to the default cache mode the browser may answer the second one
 * from cache, so the reload succeeds but hands back the pre-mutation rows — the
 * table (and its per-row actions, which are derived from row state) then
 * re-renders identically and the write looks like it did nothing.
 */
const noCacheMiddleware: Middleware = {
    async pre(context: RequestContext): Promise<FetchParams> {
        return {
            url: context.url,
            init: { ...context.init, cache: 'no-store' },
        };
    },
};

// -----------------------------------------------------------------------------
// Error-handling middleware
// -----------------------------------------------------------------------------

/**
 * Converts the well-known failure codes into typed errors and, on a 401 for an
 * authenticated request, silently refreshes the session and retries once before
 * giving up and routing to sign-in. Other 4xx fall through to the runtime's
 * `ResponseError`.
 */
const errorMiddleware: Middleware = {
    async post(context: ResponseContext): Promise<Response | void> {
        const { response, url, init } = context;
        const isPreAuth = PRE_AUTH_PATHS.some((p) => url.includes(p));

        if (response.status === 401 && !isPreAuth) {
            const headers = new Headers(init.headers as HeadersInit);
            const alreadyRetried = headers.get(RETRY_HEADER) === '1';
            const hadSession = getRefreshToken() !== null;

            if (!alreadyRetried && (await refreshTokensOnce())) {
                // Re-issue the original request once with the refreshed token.
                const token = getAccessToken();
                if (token) {
                    headers.set('Authorization', `Bearer ${token}`);
                }
                headers.set(RETRY_HEADER, '1');
                return context.fetch(url, { ...init, headers });
            }

            clearTokens();
            if (hadSession) {
                // Expired session: back to the sign-in page, as before.
                redirectToLogin();
            } else {
                // Guest. Browsing (GET page data via navigation) fails
                // silently — pages render their empty states. Only a real
                // action (mutation) prompts: quick sign-in popup when one
                // is mounted, else the sign-in page.
                const method = (init.method ?? 'GET').toUpperCase();
                const isBrowsing = ['GET', 'HEAD', 'OPTIONS'].includes(method);
                if (!isBrowsing && !promptSignIn()) {
                    redirectToLogin();
                }
            }
            throw new UnauthorizedError(response);
        }

        if (response.status === 403) {
            throw new PermissionError(response);
        }

        if (response.status >= 500) {
            throw new ServerError(response.status, response);
        }

        // 2xx and other 4xx are left for the caller / generated runtime.
        return response;
    },
};

// -----------------------------------------------------------------------------
// Singleton configuration
// -----------------------------------------------------------------------------

/**
 * Shared configuration consumed by every generated API class. Built once and
 * reused so token resolution and middleware are consistent app-wide.
 */
export const apiConfiguration = new Configuration({
    basePath: environment.apiBaseUrl,
    // The generated APIs call this and prefix `Bearer ` automatically; returning
    // an empty string when signed out means no Authorization header is added.
    accessToken: () => getAccessToken() ?? '',
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
    // `pre` runs in order, `post` in reverse — errorMiddleware stays last so
    // its `post` still sees the response first.
    middleware: [noCacheMiddleware, errorMiddleware],
});
