/**
 * "2 giờ trước" / "2 hours ago" from an ISO timestamp.
 *
 * Built on `Intl.RelativeTimeFormat`, so the wording and pluralisation come
 * from the platform's own locale data rather than from translation strings we
 * would have to write — and keep correct — for every unit in both languages.
 *
 * Used where the *age* of a value is part of what it means: a produce price
 * restated this morning is a different offer from the same number three days
 * old.
 */

/** Largest unit whose threshold the elapsed time clears, seconds first. */
const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 60 * 60],
    ['month', 30 * 24 * 60 * 60],
    ['day', 24 * 60 * 60],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
];

/**
 * One formatter per locale.
 *
 * `new Intl.RelativeTimeFormat` is not cheap, and the catalog calls this once
 * per tile on every change-detection pass (the tile view model is rebuilt each
 * time). At a few hundred tiles that is a formatter per product per pass; there
 * are only ever two locales.
 */
const FORMATTERS = new Map<string, Intl.RelativeTimeFormat>();

function formatterFor(lang: string): Intl.RelativeTimeFormat {
    let formatter = FORMATTERS.get(lang);
    if (!formatter) {
        formatter = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
        FORMATTERS.set(lang, formatter);
    }
    return formatter;
}

/**
 * Formats how long ago `isoDate` was, in `lang`.
 *
 * Returns `null` — not a placeholder — for a missing or unparseable value, so
 * callers omit the line rather than render "Invalid Date". A timestamp in the
 * future (clock skew between the server and the browser) is reported as "now"
 * rather than as a countdown, which would read as a scheduled change.
 */
export function formatRelativeTime(
    isoDate: string | null | undefined,
    lang: string
): string | null {
    if (!isoDate) {
        return null;
    }
    const then = new Date(isoDate).getTime();
    if (Number.isNaN(then)) {
        return null;
    }

    const elapsedSeconds = Math.round((Date.now() - then) / 1000);
    const formatter = formatterFor(lang);

    if (elapsedSeconds < 60) {
        // Covers future timestamps too: `numeric: 'auto'` renders 0 seconds as
        // "now"/"bây giờ" instead of "in 0 seconds".
        return formatter.format(0, 'second');
    }

    for (const [unit, seconds] of UNITS) {
        if (elapsedSeconds >= seconds) {
            return formatter.format(
                -Math.floor(elapsedSeconds / seconds),
                unit
            );
        }
    }
    return formatter.format(0, 'second');
}
