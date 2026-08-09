/**
 * A stand-in picture for a product with no photo.
 *
 * The storefront is browsable without an account, but `GET /products` — which
 * carries the images — is not: a guest's catalogue therefore arrives with every
 * `thumbnail` empty. A grid of identical grey boxes reads as broken, so each
 * tile falls back to an emoji and a tint chosen from its category. Signed-in
 * users get the same fallback for any product whose image has not been uploaded
 * yet, so this is not a guest-only path and does not need to know who is asking.
 *
 * Deliberately a *fallback*, never an override: a real photo always wins.
 */
import { foldSearchText } from 'app/core/util/text-search';

/** Emoji + background for one family of categories. */
interface CategoryVisual {
    emoji: string;
    /** Any CSS background value; kept soft so the emoji stays the subject. */
    tint: string;
}

/**
 * Keyword → visual, first match wins, so order matters: narrower keywords sit
 * above the families that would otherwise swallow them ("trái cây" before the
 * root-vegetable rule).
 *
 * Keywords match **whole words**, not substrings, and every one is either a
 * multi-word phrase or a word that means only one thing once folded. Both rules
 * exist because folding erases the diacritics that carry the meaning: "lá"
 * (leaf) and "lạ" (strange) both become "la", so a bare `la` keyword painted a
 * lettuce on any category with "lạ" in its name. Anything that short and that
 * ambiguous belongs in a phrase.
 */
const RULES: readonly {
    keywords: readonly string[];
    visual: CategoryVisual;
}[] = [
    {
        keywords: ['trai cay', 'hoa qua', 'fruit', 'fruits'],
        visual: {
            emoji: '🍊',
            tint: 'linear-gradient(135deg,#FFF4E0,#FFE3BF)',
        },
    },
    {
        keywords: ['hai san', 'thuy san', 'seafood', 'fish'],
        visual: {
            emoji: '🐟',
            tint: 'linear-gradient(135deg,#E4F4FB,#C9E8F5)',
        },
    },
    {
        keywords: ['thit', 'gia cam', 'meat', 'poultry'],
        visual: {
            emoji: '🥩',
            tint: 'linear-gradient(135deg,#FDEAEA,#F8D3D3)',
        },
    },
    {
        keywords: ['trung', 'egg', 'eggs'],
        visual: {
            emoji: '🥚',
            tint: 'linear-gradient(135deg,#FFF8E1,#FDEEC0)',
        },
    },
    {
        keywords: ['sua', 'dairy', 'milk'],
        visual: {
            emoji: '🥛',
            tint: 'linear-gradient(135deg,#F3F6FF,#DDE5FA)',
        },
    },
    {
        keywords: ['gao', 'ngu coc', 'rice', 'grain', 'grains'],
        visual: {
            emoji: '🌾',
            tint: 'linear-gradient(135deg,#FBF5E3,#F0E4C3)',
        },
    },
    {
        keywords: ['gia vi', 'nuoc cham', 'sauce', 'spice', 'spices'],
        visual: {
            emoji: '🧂',
            tint: 'linear-gradient(135deg,#F5F3FF,#E4DEFA)',
        },
    },
    {
        keywords: ['nam', 'mushroom', 'mushrooms'],
        visual: {
            emoji: '🍄',
            tint: 'linear-gradient(135deg,#F7F1EA,#EADFD1)',
        },
    },
    {
        keywords: ['cu qua', 'cu', 'root', 'tuber'],
        visual: {
            emoji: '🥕',
            tint: 'linear-gradient(135deg,#FFF1E3,#FFDDC0)',
        },
    },
    {
        keywords: ['rau', 'rau la', 'vegetable', 'vegetables', 'green'],
        visual: {
            emoji: '🥬',
            tint: 'linear-gradient(135deg,#EDFBF2,#D2F3E0)',
        },
    },
];

/**
 * True when `keyword` appears in `folded` as a whole word (or whole phrase).
 *
 * Folded text is ASCII words separated by non-word characters, so splitting on
 * word characters and re-joining with a single space lets one `includes` cover
 * both single words and phrases without a regex per keyword.
 */
function hasWholeWord(folded: string, keyword: string): boolean {
    return ` ${folded} `.includes(` ${keyword} `);
}

/** Used when nothing matches — the tile's own default, stated here too. */
const FALLBACK: CategoryVisual = {
    emoji: '🧺',
    tint: 'linear-gradient(135deg,#F5F7FA,#E6EBF2)',
};

/**
 * The emoji and tint to show for `category` when a product has no photo.
 * An unrecognised or empty category gets the neutral basket rather than a
 * wrong-looking guess.
 */
export function categoryVisual(category: string | null | undefined): {
    emoji: string;
    thumbTint: string;
} {
    // Normalise punctuation to spaces so "Củ - Quả" and "Củ, Quả" both reduce
    // to the same word sequence the keywords are written against.
    const folded = foldSearchText(category ?? '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    if (folded) {
        for (const rule of RULES) {
            if (
                rule.keywords.some((keyword) => hasWholeWord(folded, keyword))
            ) {
                return {
                    emoji: rule.visual.emoji,
                    thumbTint: rule.visual.tint,
                };
            }
        }
    }
    return { emoji: FALLBACK.emoji, thumbTint: FALLBACK.tint };
}
