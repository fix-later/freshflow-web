/**
 * Accent-insensitive text helpers for client-side search.
 *
 * Vietnamese (and other Latin-script) queries typed without diacritics still
 * match accented values — e.g. "hai san" → "Hải sản", "cu qua" → "Củ - Quả".
 * `đ`/`Đ` are folded to `d` because they are not NFD combining marks.
 */

/** Lowercases and strips diacritics so "Hải" and "hai" compare equal. */
export function foldSearchText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/đ/gi, 'd')
        .toLowerCase();
}

/**
 * True when `haystack` contains `needle` after both are folded.
 * An empty/whitespace needle matches everything.
 */
export function includesFolded(haystack: string, needle: string): boolean {
    const term = foldSearchText(needle).trim();
    if (!term) {
        return true;
    }
    return foldSearchText(haystack).includes(term);
}
