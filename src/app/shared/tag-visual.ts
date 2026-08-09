/**
 * Picks a colour for a catalog tag from its **name**.
 *
 * Tags are free vocabulary — the admin adds whatever the markets need — so the
 * palette cannot be a lookup table keyed on meanings nobody declared. Instead
 * the name is hashed to one of {@link TAG_VARIANTS}, which gives two properties
 * worth more than a hand-picked colour would be:
 *
 *  - **Stable.** The same tag is the same colour on the product tile, in the
 *    catalog facet, in the Hot Deals rail and on the detail page, in this
 *    session and the next, for every user. A colour assigned by list position
 *    would shuffle whenever the list did.
 *  - **Free of meaning.** These are labels, not statuses. They deliberately do
 *    not reuse the `admin-pill-*` family, where red means danger and green
 *    means success — a tag that happened to hash to red would otherwise read as
 *    a warning about the product.
 *
 * Names are folded (trim + lower case) the same way the server stores them
 * (`Tag.NormalizeName`), so casing drift on any one surface cannot move a tag
 * to a different colour.
 */

/**
 * The palette, as class suffixes. Each has a light and a dark step defined in
 * `styles.scss` under `.ff-tag--*`.
 *
 * Eleven entries, a prime count: with a power-of-two palette the low bits of
 * the hash decide everything, and names sharing a suffix bunch onto the same
 * few colours.
 */
export const TAG_VARIANTS = [
    'lime',
    'teal',
    'sky',
    'indigo',
    'violet',
    'fuchsia',
    'rose',
    'orange',
    'amber',
    'emerald',
    'cyan',
] as const;

export type TagVariant = (typeof TAG_VARIANTS)[number];

/**
 * FNV-1a over the folded name. Chosen over `reduce((h, c) => h * 31 + c)`
 * because that overflows into float territory past a few characters and starts
 * losing the low bits — which are exactly the ones the modulo reads.
 */
function hashName(name: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < name.length; i++) {
        hash ^= name.charCodeAt(i);
        // `Math.imul` keeps the multiply in 32-bit integer space.
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/** The palette entry for `name`; empty names get the first variant. */
export function tagVariant(name: string | null | undefined): TagVariant {
    const folded = (name ?? '').trim().toLowerCase();
    if (!folded) {
        return TAG_VARIANTS[0];
    }
    return TAG_VARIANTS[hashName(folded) % TAG_VARIANTS.length];
}

/** Ready-to-bind class list for a tag chip, e.g. `ff-tag ff-tag--sky`. */
export function tagClass(name: string | null | undefined): string {
    return `ff-tag ff-tag--${tagVariant(name)}`;
}
