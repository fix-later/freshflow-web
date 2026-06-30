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
import { clearAccessToken, getAccessToken, redirectToLogin } from './auth';
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
// Error-handling middleware
// -----------------------------------------------------------------------------

/**
 * Inspects every response and converts the well-known failure codes into typed
 * errors. Runs before the generated runtime's own non-2xx check, so these take
 * precedence. Other 4xx codes fall through to the runtime's `ResponseError`.
 */
const errorMiddleware: Middleware = {
    async post(context: ResponseContext): Promise<Response | void> {
        const { response } = context;

        if (response.status === 401) {
            clearAccessToken();
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
