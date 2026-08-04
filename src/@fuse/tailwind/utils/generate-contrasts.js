const chroma = require('chroma-js');
const _ = require('lodash');

/**
 * WCAG AA for normal-size text. Every generated pair must clear this: these
 * values become Angular Material's `*-contrast` palette entries (text and icons
 * on filled buttons, chips, checkboxes, badges…) and the `--fuse-on-*` custom
 * properties, so anything below this ships as unreadable component text.
 */
const MIN_CONTRAST = 4.5;

/** How far the brand-tinted ink may be darkened before falling back to B/W. */
const MAX_DARKEN_STEPS = 12;
const DARKEN_STEP = 0.5;

/**
 * Generates contrasting counterparts of the given palette.
 * The provided palette must be in the same format with
 * default Tailwind color palettes.
 *
 * Ink is chosen in two stages:
 *
 *  1. **Brand-tinted.** Start from the palette's own darkest hue — this is what
 *     gives Fuse's on-colors their tint rather than flat black — and darken it
 *     until it clears {@link MIN_CONTRAST}.
 *  2. **Black or white.** If the tinted ink cannot get there, use whichever pure
 *     end reads better. One of them always clears 4.5:1: black passes for any
 *     relative luminance ≥ 0.175 and white for any ≤ 0.183, and those ranges
 *     overlap, so no color can fail both.
 *
 * The previous implementation had no floor — it took whichever of {darkest hue,
 * white} merely scored higher. On a light, vivid palette that shipped pairs as
 * poor as 2.34:1 (mint 700), because "the darkest mint" is still a mid-green.
 *
 * @param palette
 * @private
 */
const generateContrasts = (palette) => {
    const lightColor = '#FFFFFF';
    let darkColor = '#FFFFFF';

    // Iterate through the palette to find the darkest color
    _.forEach(palette, (color) => {
        darkColor =
            chroma.contrast(color, '#FFFFFF') >
            chroma.contrast(darkColor, '#FFFFFF')
                ? color
                : darkColor;
    });

    /** Readable ink for one background color. */
    const inkFor = (color) => {
        let ink = chroma(darkColor);
        for (let step = 0; step <= MAX_DARKEN_STEPS; step++) {
            if (chroma.contrast(color, ink) >= MIN_CONTRAST) {
                return ink.hex().toUpperCase();
            }
            ink = ink.darken(DARKEN_STEP);
        }
        return chroma.contrast(color, '#000000') >
            chroma.contrast(color, lightColor)
            ? '#000000'
            : lightColor;
    };

    // Generate the contrasting colors
    return _.fromPairs(_.map(palette, (color, hue) => [hue, inkFor(color)]));
};

module.exports = generateContrasts;
