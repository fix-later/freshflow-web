/**
 * Escape hatch for request bodies the generated client cannot express.
 *
 * The generated `*ToJSON` serialisers rebuild the payload from the documented
 * properties only, so a field absent from the OpenAPI schema is dropped before
 * the request is sent — it never reaches the server. When the backend accepts a
 * field the spec does not declare, the call has to bypass that serialiser.
 *
 * It still goes through {@link apiConfiguration}, so bearer auth, the no-store
 * cache policy, the 401 refresh-and-retry and the typed error classes all apply
 * exactly as they do for generated calls. Prefer the generated methods; reach
 * for this only for a documented-as-missing field, and drop it once the spec
 * catches up.
 */
import { apiConfiguration } from './client';
import { BaseAPI, type HTTPMethod } from './generated';

class RawApi extends BaseAPI {
    /** Sends `body` verbatim (no schema filtering) and returns the response. */
    async send(
        path: string,
        method: HTTPMethod,
        body?: unknown
    ): Promise<Response> {
        return this.request({
            path,
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body as object,
        });
    }
}

export const rawApi = new RawApi(apiConfiguration);
