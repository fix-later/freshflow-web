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
import { ApiError, ResponseError } from 'contract';

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

/**
 * Structured view of a failed API call, normalised across the two body shapes
 * the backend can send (see {@link readApiError}).
 */
export interface ApiErrorInfo {
    /** HTTP status of the response, so callers can localize by category. */
    status?: number;
    /** Machine-readable code, e.g. `EMAIL_ALREADY_EXISTS` (when present). */
    code?: string;
    /** Human-readable message from the server (may be untranslated). */
    message?: string;
    /** Per-field validation messages, keyed by field name. */
    fieldErrors?: Record<string, string>;
}

/**
 * Reads the response body from a failed API call into a normalised
 * {@link ApiErrorInfo}, so callers can react to the backend's own `code`
 * (mapping it to a localized message) and surface field-level detail.
 *
 * Two error shapes carry a response:
 *  - the generated {@link ResponseError} (4xx the middleware lets through —
 *    400/404/409/422), and
 *  - the typed {@link ApiError} subclasses thrown for 401/403/5xx
 *    ({@link PermissionError} etc.).
 *
 * Two body shapes are understood:
 *  - the FreshFlow envelope `{ error: { code, message, details:[{field,message}] } }`
 *    (see `docs/04-api-design.md` §1.3), and
 *  - RFC 7807 `ProblemDetails` (`detail`/`title`, an `errors` validation map,
 *    with `message`/`error` as fallbacks).
 *
 * Returns `undefined` for a non-HTTP failure or a bodiless response.
 */
export async function readApiError(
    err: unknown
): Promise<ApiErrorInfo | undefined> {
    const response =
        err instanceof ResponseError
            ? err.response
            : err instanceof ApiError
              ? err.response
              : undefined;
    if (!response) {
        return undefined;
    }
    const status = response.status || undefined;
    const body = await parseJson<Record<string, unknown>>(response.clone());
    if (!body) {
        // A bodiless rejection (common for 401/403/404/5xx) still tells us the
        // category via its status, so the caller can localize by that.
        return { status };
    }

    // FreshFlow envelope: { success:false, error:{ code, message, details:[…] } }.
    const envelope = body['error'];
    if (envelope && typeof envelope === 'object') {
        const e = envelope as Record<string, unknown>;
        const info: ApiErrorInfo = { status };
        if (typeof e['code'] === 'string') {
            info.code = e['code'];
        }
        if (typeof e['message'] === 'string' && e['message'].trim()) {
            info.message = e['message'];
        }
        const fieldErrors = detailsToFieldErrors(e['details']);
        if (fieldErrors) {
            info.fieldErrors = fieldErrors;
        }
        return info;
    }

    // RFC 7807 ProblemDetails.
    const info: ApiErrorInfo = { status };
    if (typeof body['code'] === 'string') {
        info.code = body['code'];
    }
    if (body['errors'] && typeof body['errors'] === 'object') {
        const map: Record<string, string> = {};
        for (const [field, value] of Object.entries(
            body['errors'] as Record<string, unknown>
        )) {
            const msg = (Array.isArray(value) ? value : [value])
                .filter((v): v is string => typeof v === 'string')
                .join(' ');
            if (msg.trim()) {
                map[field] = msg;
            }
        }
        if (Object.keys(map).length) {
            info.fieldErrors = map;
        }
    }
    for (const key of ['detail', 'title', 'message', 'error']) {
        const value = body[key];
        if (typeof value === 'string' && value.trim()) {
            info.message = value;
            break;
        }
    }
    return info;
}

/** Reads a `details: [{ field, message }]` array into a `{ field: message }` map. */
function detailsToFieldErrors(
    details: unknown
): Record<string, string> | undefined {
    if (!Array.isArray(details)) {
        return undefined;
    }
    const map: Record<string, string> = {};
    for (const entry of details) {
        if (entry && typeof entry === 'object') {
            const field = (entry as Record<string, unknown>)['field'];
            const message = (entry as Record<string, unknown>)['message'];
            if (typeof field === 'string' && typeof message === 'string') {
                map[field] = message;
            }
        }
    }
    return Object.keys(map).length ? map : undefined;
}

/**
 * Extracts a human-readable reason from a failed API call, so a backend
 * rejection can be shown to the user instead of a generic "something went
 * wrong". Field-level validation detail takes precedence over the summary
 * message. Returns `undefined` when nothing usable is present, so callers can
 * fall back to their own translated message.
 */
export async function apiErrorMessage(
    err: unknown
): Promise<string | undefined> {
    const info = await readApiError(err);
    if (!info) {
        return undefined;
    }
    if (info.fieldErrors) {
        const joined = Object.values(info.fieldErrors).join(' ');
        if (joined.trim()) {
            return joined;
        }
    }
    return info.message?.trim() ? info.message : undefined;
}

/**
 * Reads the filename out of a `Content-Disposition` header.
 *
 * Prefers RFC 5987 `filename*=UTF-8''…` when present — invoice and statement
 * names can carry Vietnamese diacritics, and the plain `filename=` fallback is
 * where servers put an ASCII-mangled version of the same name.
 *
 * Lives here rather than beside one caller because every binary download the
 * app offers (invoice XML, invoice PDF, statement PDF, analytics export) reads
 * the same header off a raw `Response`.
 */
export function fileNameFromContentDisposition(
    header: string | null
): string | undefined {
    if (!header) {
        return undefined;
    }
    const extended = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (extended) {
        try {
            return decodeURIComponent(extended[1].trim());
        } catch {
            // Malformed percent-encoding — fall through to the plain form.
        }
    }
    const plain = /filename="?([^";]+)"?/i.exec(header);
    return plain ? plain[1].trim() : undefined;
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
 * (`items`/`data`/`results`/`value`, plus the order-groups `batches`) and one
 * level of nesting (e.g. the .NET shape `{ data: { items: [...] } }`). Unknown
 * shapes degrade to `[]`.
 */
export function extractList<T>(body: unknown): T[] {
    if (Array.isArray(body)) {
        return body as T[];
    }
    if (!body || typeof body !== 'object') {
        return [];
    }
    const record = body as Record<string, unknown>;
    for (const key of ['items', 'data', 'results', 'value', 'batches']) {
        if (Array.isArray(record[key])) {
            return record[key] as T[];
        }
    }
    if (record['data'] && typeof record['data'] === 'object') {
        return extractList<T>(record['data']);
    }
    return [];
}

/** Offset pagination as the backend reports it (all fields optional). */
export interface PageInfo {
    /** Total matching rows across all pages. */
    total?: number;
    /** 1-based page number of this response. */
    page?: number;
    pageSize?: number;
}

/** First numeric value among `keys` on `record`, else `undefined`. */
function firstNumber(
    record: Record<string, unknown>,
    keys: string[]
): number | undefined {
    for (const key of keys) {
        if (typeof record[key] === 'number') {
            return record[key] as number;
        }
    }
    return undefined;
}

/**
 * Reads the `{ total, page, pageSize }` block from a list envelope, wherever
 * the backend puts it — a `pagination` or `meta` wrapper, or the top level —
 * tolerating the common key aliases. Drive the paginator from this (page-based)
 * rather than inferring page count from a running total.
 */
export function extractPagination(body: unknown): PageInfo | undefined {
    if (!body || typeof body !== 'object') {
        return undefined;
    }
    const record = body as Record<string, unknown>;
    for (const wrapper of ['pagination', 'meta']) {
        const inner = record[wrapper];
        if (inner && typeof inner === 'object') {
            const info = readPageInfo(inner as Record<string, unknown>);
            if (info) {
                return info;
            }
        }
    }
    const top = readPageInfo(record);
    if (top) {
        return top;
    }
    if (record['data'] && typeof record['data'] === 'object') {
        return extractPagination(record['data']);
    }
    return undefined;
}

function readPageInfo(record: Record<string, unknown>): PageInfo | undefined {
    const total = firstNumber(record, ['total', 'totalCount', 'totalItems']);
    const page = firstNumber(record, ['page', 'pageNumber', 'currentPage']);
    const pageSize = firstNumber(record, ['pageSize', 'perPage', 'limit']);
    if (total === undefined && page === undefined && pageSize === undefined) {
        return undefined;
    }
    return { total, page, pageSize };
}

/** Reads a total-count value from a list envelope, if the backend sends one. */
export function extractTotal(body: unknown): number | undefined {
    if (!body || typeof body !== 'object') {
        return undefined;
    }
    const record = body as Record<string, unknown>;
    const direct = firstNumber(record, [
        'totalCount',
        'total',
        'totalItems',
        'count',
    ]);
    if (direct !== undefined) {
        return direct;
    }
    for (const wrapper of ['pagination', 'meta', 'data']) {
        const inner = record[wrapper];
        if (inner && typeof inner === 'object') {
            const found = extractTotal(inner);
            if (found !== undefined) {
                return found;
            }
        }
    }
    return undefined;
}

/**
 * Reads the opaque `nextCursor` from a cursor-paginated list envelope. Looks in
 * `meta.nextCursor` (the documented location) and the common fallbacks, so it
 * tolerates the couple of body shapes the backend uses. Returns `undefined`
 * when there is no further page — treat that as "stop".
 */
export function extractNextCursor(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') {
        return undefined;
    }
    const record = body as Record<string, unknown>;
    const meta = record['meta'];
    if (meta && typeof meta === 'object') {
        const cursor = (meta as Record<string, unknown>)['nextCursor'];
        if (typeof cursor === 'string' && cursor) {
            return cursor;
        }
    }
    for (const key of ['nextCursor', 'cursor']) {
        if (typeof record[key] === 'string' && record[key]) {
            return record[key] as string;
        }
    }
    if (record['data'] && typeof record['data'] === 'object') {
        return extractNextCursor(record['data']);
    }
    return undefined;
}

/**
 * Safety cap on the pagination loops below: at {@link MAX_PAGE_SIZE} rows/page
 * this is 100k rows, far beyond any admin list, and stops a misbehaving cursor
 * from looping forever.
 */
const MAX_PAGES = 1000;

/**
 * Fetches every page of an **offset-paginated** list (`page`/`pageSize`) and
 * concatenates the raw rows (apply {@link withId} yourself if needed). The
 * backend caps `pageSize` at {@link MAX_PAGE_SIZE}, so a single request only
 * returns the first page. `fetchPage` returns the raw `Response` for a 1-based
 * page. Stops on a short page or once the reported total is reached.
 */
export async function fetchAllOffset<T>(
    fetchPage: (page: number, pageSize: number) => Promise<Response>
): Promise<T[]> {
    const pageSize = MAX_PAGE_SIZE;
    const all: T[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
        const body = await parseJson(await fetchPage(page, pageSize));
        const rows = extractList<T>(body);
        all.push(...rows);
        const total = extractTotal(body);
        if (rows.length < pageSize || (total != null && all.length >= total)) {
            break;
        }
    }
    return all;
}

/**
 * Fetches every page of a **cursor-paginated** list and concatenates the raw
 * rows. `fetchPage` receives the cursor to request (`undefined` for the first
 * page). Follows `nextCursor` until it is absent — so if the backend doesn't
 * return one, this stops after the first page (identical to a single fetch, no
 * regression) rather than looping. Also guards against a non-advancing cursor.
 */
export async function fetchAllCursor<T>(
    fetchPage: (
        cursor: string | undefined,
        pageSize: number
    ) => Promise<Response>
): Promise<T[]> {
    const pageSize = MAX_PAGE_SIZE;
    const all: T[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let i = 0; i < MAX_PAGES; i++) {
        const body = await parseJson(await fetchPage(cursor, pageSize));
        const rows = extractList<T>(body);
        all.push(...rows);
        const next = extractNextCursor(body);
        if (!next || rows.length < pageSize || seen.has(next)) {
            break;
        }
        seen.add(next);
        cursor = next;
    }
    return all;
}
