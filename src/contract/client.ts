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
    redirectToLogin,
    setTokens,
} from './auth';
import {
    Configuration,
    type Middleware,
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
            redirectToLogin();
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
    middleware: [errorMiddleware],
});
