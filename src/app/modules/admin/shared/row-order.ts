/**
 * The order every admin list falls back to: **live rows first, newest first**.
 *
 * Backends here return rows in whatever order the query produced — insertion
 * order for most tables — so the oldest record, and the ones switched off years
 * ago, led every screen. What an operator opens a list for is what changed
 * recently and what is still running, so that is what the top of the list shows
 * until they sort a column themselves.
 *
 * This orders the rows in hand. On the server-paginated screens (users, order
 * groups, invoices) that is the page currently loaded, not the whole table —
 * none of those endpoints takes a sort parameter.
 */

/** A row from any admin list; the fields read below are all optional. */
type OrderableRow = Record<string, unknown>;

/**
 * Fields that mean "switched off", in the two spellings the API uses. A row
 * counts as live unless one of them says otherwise, so a list of rows that
 * carry neither keeps its order.
 */
function isRetired(row: OrderableRow): boolean {
    if (row['isActive'] === false) {
        return true;
    }
    const deletedAt = row['deletedAt'];
    return deletedAt !== null && deletedAt !== undefined && deletedAt !== '';
}

/**
 * Timestamps in the order they answer "when did this happen", most specific
 * first. `createdAt` is the row's own age; the rest are the domain dates the
 * screens that lack it are actually about.
 */
const TIME_FIELDS = [
    'createdAt',
    'timestamp',
    'occurredAt',
    'issuedAt',
    'reportedAt',
    // A statement is placed by the period it covers, not by when it was run.
    'periodStart',
    'generatedAt',
    'batchDate',
    'targetDate',
    'serviceDate',
    'updatedAt',
] as const;

/** Epoch millis for the first timestamp the row carries, or `null`. */
function rowTime(row: OrderableRow): number | null {
    for (const field of TIME_FIELDS) {
        const raw = row[field];
        if (raw === null || raw === undefined || raw === '') {
            continue;
        }
        const parsed =
            raw instanceof Date ? raw.getTime() : Date.parse(String(raw));
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return null;
}

/**
 * Sorted copy of `rows`: live before retired, then newest before oldest.
 *
 * Rows with no timestamp keep their relative order (`Array.sort` is stable) and
 * sink below the dated ones — an undated row is unplaceable in time, not new.
 */
export function newestActiveFirst<T>(rows: readonly T[]): T[] {
    return [...rows].sort((a, b) => {
        const left = a as OrderableRow;
        const right = b as OrderableRow;

        const retired = Number(isRetired(left)) - Number(isRetired(right));
        if (retired !== 0) {
            return retired;
        }

        const leftTime = rowTime(left);
        const rightTime = rowTime(right);
        if (leftTime === rightTime) {
            return 0;
        }
        if (leftTime === null) {
            return 1;
        }
        if (rightTime === null) {
            return -1;
        }
        return rightTime - leftTime;
    });
}
