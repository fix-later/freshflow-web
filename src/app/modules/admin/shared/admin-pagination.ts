/**
 * Shared offset-pagination defaults for admin table screens.
 *
 * API contract: `?page=<1-based>&pageSize=<n>` with response
 * `pagination` / `meta`: `{ total, page, pageSize }`.
 * MatPaginator uses 0-based `pageIndex` — convert with `pageIndex + 1`.
 */
export const ADMIN_DEFAULT_PAGE = 1;
export const ADMIN_DEFAULT_PAGE_SIZE = 10;
export const ADMIN_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

/** Convert MatPaginator pageIndex (0-based) to API page (1-based). */
export function toApiPage(pageIndex: number): number {
    return pageIndex + 1;
}

/** Convert API page (1-based) to MatPaginator pageIndex (0-based). */
export function toPageIndex(page: number): number {
    return Math.max(0, page - 1);
}
