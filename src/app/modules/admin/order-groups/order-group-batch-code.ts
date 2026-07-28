/**
 * Resolves / derives a human-readable batch code ("mã lô").
 *
 * Backend `ProcurementBatchDto` only exposes Guid `id` (no `batchNumber`
 * column). When the API later adds an explicit code we prefer it; otherwise
 * we derive a stable, searchable label from batch date + id prefix:
 * `LO-20260728-A1B2C3D4`.
 */

const BATCH_NUMBER_KEYS = [
    'batchNumber',
    'BatchNumber',
    'batch_number',
    'batchCode',
    'BatchCode',
    'batch_code',
    'code',
    'Code',
    'maLo',
    'MaLo',
] as const;

const BATCH_ID_KEYS = [
    'id',
    'Id',
    'batchId',
    'BatchId',
    'procurementBatchId',
    'ProcurementBatchId',
] as const;

function firstNonEmptyString(
    row: Record<string, unknown>,
    keys: readonly string[]
): string {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return String(value);
        }
    }
    return '';
}

/** Human batch code when the API provides one; otherwise ''. */
export function resolveBatchNumber(
    row: Record<string, unknown> | null | undefined
): string {
    if (!row) {
        return '';
    }
    // Skip generic `name`/`number` — they collide with unrelated fields.
    return firstNonEmptyString(row, BATCH_NUMBER_KEYS);
}

/** Stable batch id for routing / tracking. */
export function resolveBatchId(
    row: Record<string, unknown> | null | undefined
): string {
    if (!row) {
        return '';
    }
    return firstNonEmptyString(row, BATCH_ID_KEYS);
}

/** `yyyyMMdd` from ISO date / DateOnly / DateTime, or ''. */
function batchDateStamp(row: Record<string, unknown>): string {
    const raw =
        row['batchDate'] ??
        row['BatchDate'] ??
        row['createdAt'] ??
        row['CreatedAt'];
    if (raw === null || raw === undefined || raw === '') {
        return '';
    }
    const text = String(raw);
    const isoDay = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDay) {
        return `${isoDay[1]}${isoDay[2]}${isoDay[3]}`;
    }
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

/** First 8 hex chars of a UUID, uppercased (no dashes). */
export function shortBatchId(id: string): string {
    return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/**
 * Derived mã lô when the API has no explicit code.
 * Example: `LO-20260728-A1B2C3D4`
 */
export function deriveBatchNumber(
    row: Record<string, unknown> | null | undefined
): string {
    if (!row) {
        return '';
    }
    const id = resolveBatchId(row);
    if (!id) {
        return '';
    }
    const stamp = batchDateStamp(row);
    const short = shortBatchId(id);
    return stamp ? `LO-${stamp}-${short}` : `LO-${short}`;
}

/**
 * Label shown in tables / headers: API code → derived mã lô → id → '—'.
 */
export function batchDisplayCode(
    row: Record<string, unknown> | null | undefined
): string {
    return (
        resolveBatchNumber(row) ||
        deriveBatchNumber(row) ||
        resolveBatchId(row) ||
        '—'
    );
}

/**
 * All strings that should match a mã-lô search for this row (display code,
 * short id, full uuid, API code).
 */
export function batchSearchHaystack(
    row: Record<string, unknown> | null | undefined
): string {
    if (!row) {
        return '';
    }
    const id = resolveBatchId(row);
    return [
        resolveBatchNumber(row),
        deriveBatchNumber(row),
        id,
        id ? shortBatchId(id) : '',
        id.replace(/-/g, ''),
    ]
        .filter(Boolean)
        .join(' ');
}
