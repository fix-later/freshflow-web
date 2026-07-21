/**
 * Helpers for reading the backend's untyped list/envelope responses.
 *
 * The OpenAPI spec declares no response schemas (every endpoint is `200 OK`
 * with no body), and the API wraps payloads in a `{ success, data }` envelope —
 * list endpoints put the array at `data.items` with `data.totalCount`. These
 * helpers unwrap that defensively so callers always get a well-typed value and
 * an `@for` never receives a non-iterable. Mirrors the parsing in
 * `catalog.service.ts` / `admin.service.ts`, centralised for reuse.
 */

/**
 * Largest `pageSize` the backend accepts on list endpoints.
 *
 * Anything above this answers 400, which surfaces as an empty screen rather
 * than an error the user can act on. Import this instead of writing a literal:
 * the cap was previously fixed on one screen at a time and the others kept
 * failing.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Guarantees every row carries an `id`, reading it from the first key present.
 *
 * List bodies are untyped, and the API does not name the identifier uniformly —
 * hub routes use both `{id}` and `{hubId}`, for instance. Screens then feed
 * `row.id` straight into a path parameter, so a row that spells it differently
 * produces `DELETE /hubs/undefined`, or an edit that saves as a brand new
 * record. Normalising here means every caller can rely on `row.id`.
 *
 * Pass the resource's own alternates, e.g. `withId(rows, 'hubId')`.
 */
export function withId<T extends Record<string, unknown>>(
    rows: T[],
    ...alternateKeys: string[]
): (T & { id: string })[] {
    const keys = ['id', ...alternateKeys];
    return rows.map((row) => {
        const key = keys.find(
            (k) => row[k] != null && String(row[k]).trim() !== ''
        );
        return { ...row, id: key ? String(row[key]) : '' };
    });
}

/** Parses a JSON body, tolerating an empty (`void`) response. */
export async function parseJson<T>(response: Response): Promise<T | undefined> {
    const text = await response.text();
    if (!text) {
        return undefined;
    }
    try {
        return JSON.parse(text) as T;
    } catch {
        return undefined;
    }
}

/** Unwraps a single `{ success, data }` envelope, tolerating a bare body. */
export function unwrapData<T>(body: unknown): T | undefined {
    if (body && typeof body === 'object' && 'data' in body) {
        return (body as { data?: T }).data;
    }
    return body as T | undefined;
}

/**
 * Returns the first array found in an untyped list response, guaranteeing an
 * array. Handles a bare array, the common envelope keys
 * (`items`/`data`/`results`/`value`) and one level of nesting (e.g. the .NET
 * shape `{ data: { items: [...] } }`). Unknown shapes degrade to `[]`.
 */
export function extractList<T>(body: unknown): T[] {
    if (Array.isArray(body)) {
        return body as T[];
    }
    if (!body || typeof body !== 'object') {
        return [];
    }
    const record = body as Record<string, unknown>;
    for (const key of ['items', 'data', 'results', 'value']) {
        if (Array.isArray(record[key])) {
            return record[key] as T[];
        }
    }
    if (record['data'] && typeof record['data'] === 'object') {
        return extractList<T>(record['data']);
    }
    return [];
}

/** Reads a total-count value from a list envelope, if the backend sends one. */
export function extractTotal(body: unknown): number | undefined {
    if (!body || typeof body !== 'object') {
        return undefined;
    }
    const record = body as Record<string, unknown>;
    for (const key of ['totalCount', 'total', 'totalItems', 'count']) {
        if (typeof record[key] === 'number') {
            return record[key] as number;
        }
    }
    if (record['data'] && typeof record['data'] === 'object') {
        return extractTotal(record['data']);
    }
    return undefined;
}
