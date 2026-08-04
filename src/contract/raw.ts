/**
 * Escape hatch for calls the generated client cannot express.
 *
 * Two cases:
 *  1. **Undeclared request fields** — the generated `*ToJSON` serialisers
 *     rebuild the payload from the documented properties only, so a field
 *     absent from the OpenAPI schema is dropped before the request is sent.
 *  2. **Endpoints missing from `generated/`** — the snapshot in `openapi.json`
 *     can be ahead of the checked-in client (regenerating needs Docker, see
 *     `scripts/generate-api.mjs`).
 *
 * It still goes through {@link apiConfiguration}, so bearer auth, the no-store
 * cache policy, the 401 refresh-and-retry and the typed error classes all apply
 * exactly as they do for generated calls. Prefer the generated methods; reach
 * for this only for the two cases above, and drop it once `npm run generate:api`
 * catches up.
 */
import { apiConfiguration } from './client';
import { BaseAPI, type HTTPMethod, type HTTPQuery } from './generated';

class RawApi extends BaseAPI {
    /** Sends `body` verbatim (no schema filtering) and returns the response. */
    async send(
        path: string,
        method: HTTPMethod,
        body?: unknown,
        query?: HTTPQuery
    ): Promise<Response> {
        return this.request({
            path,
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body as object,
            query,
        });
    }
}

export const rawApi = new RawApi(apiConfiguration);
