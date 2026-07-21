import { signal } from '@angular/core';

export type SortDirection = 'asc' | 'desc';

/** A cell value a column can be sorted on. Nullish sorts last either way. */
export type SortValue = string | number | boolean | null | undefined;

/** Reads the sortable value of `row` for the column named `key`. */
export type SortAccessor<T> = (row: T, key: string) => SortValue;

/**
 * Compares two cell values.
 *
 * Numbers compare numerically (so 9 < 10, which a lexical compare gets wrong),
 * strings compare with Vietnamese collation (so "Đ" lands after "D" rather than
 * after "Z" as it would with a raw code-unit compare), and nullish/empty values
 * always sink to the bottom regardless of direction — an empty cell is missing
 * data, not the smallest value.
 */
function compare(a: SortValue, b: SortValue): number {
    const aEmpty = a === null || a === undefined || a === '';
    const bEmpty = b === null || b === undefined || b === '';
    if (aEmpty || bEmpty) {
        return aEmpty && bEmpty ? 0 : aEmpty ? 1 : -1;
    }
    if (typeof a === 'number' && typeof b === 'number') {
        return a - b;
    }
    if (typeof a === 'boolean' && typeof b === 'boolean') {
        return Number(a) - Number(b);
    }
    return String(a).localeCompare(String(b), 'vi', { numeric: true });
}

/**
 * Sort state for an admin table, shared by every admin table so they behave
 * identically: clicking a header cycles ascending → descending → unsorted, and
 * only one column is ever active.
 *
 * Sorting is client-side. For tables paginated by the server (users, order
 * groups) that means it orders the page currently loaded, not the whole table —
 * the backend exposes no sort parameter on those endpoints.
 */
export class TableSort<T> {
    /** Active column key, or `null` when the list is in its natural order. */
    readonly key = signal<string | null>(null);
    readonly direction = signal<SortDirection>('asc');

    /** Cycles a column through ascending → descending → unsorted. */
    toggle(key: string): void {
        if (this.key() !== key) {
            this.key.set(key);
            this.direction.set('asc');
            return;
        }
        if (this.direction() === 'asc') {
            this.direction.set('desc');
            return;
        }
        this.key.set(null);
        this.direction.set('asc');
    }

    /** Heroicons id for a column's header indicator. */
    icon(key: string): string {
        if (this.key() !== key) {
            return 'chevron-up-down';
        }
        return this.direction() === 'asc' ? 'bars-arrow-up' : 'bars-arrow-down';
    }

    /** `aria-sort` value for the column's `<th>`. */
    ariaSort(key: string): 'ascending' | 'descending' | 'none' {
        if (this.key() !== key) {
            return 'none';
        }
        return this.direction() === 'asc' ? 'ascending' : 'descending';
    }

    /** Returns a sorted copy of `rows`, or `rows` itself when unsorted. */
    apply(rows: T[], accessor: SortAccessor<T>): T[] {
        const key = this.key();
        if (!key) {
            return rows;
        }
        const factor = this.direction() === 'asc' ? 1 : -1;
        // Copy first: Array.prototype.sort mutates, and `rows` is signal state.
        return [...rows].sort(
            (a, b) => compare(accessor(a, key), accessor(b, key)) * factor
        );
    }
}
