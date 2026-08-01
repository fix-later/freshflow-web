/**
 * Fails the build when any brand palette would ship unreadable on-colors.
 *
 * `generateContrasts` decides the text/icon color on every filled surface in the
 * app: `tailwind.config.js` feeds its output to Angular Material as the
 * palette's `*-contrast` entries and to the `--fuse-on-*` custom properties. A
 * regression there is not a styling nit — it ships unreadable buttons, chips and
 * checkboxes, and nothing else in the pipeline would catch it.
 *
 * This runs in `npm run precheck`. It lives here rather than in a `.spec.ts`
 * because the utils are CommonJS consumed by the Tailwind config at build time;
 * pulling them into the Karma TypeScript program needs `allowJs`, which breaks
 * the Angular test builder's virtual entry point.
 *
 * Run: node scripts/check-contrast.mjs
 */
import chroma from 'chroma-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const generateContrasts = require('../src/@fuse/tailwind/utils/generate-contrasts');
const tailwindConfig = require('../tailwind.config.js');

/** WCAG AA for normal-size text — what these pairs are used for. */
const MIN_CONTRAST = 4.5;

let failures = 0;
let checked = 0;

/** The same object the theming plugin receives (see tailwind.config.js). */
const themes = tailwindConfig.__themes;

if (!themes?.default) {
    console.error(
        'check-contrast: tailwind.config.js must export `__themes` for this check to run.'
    );
    process.exit(1);
}

for (const [paletteName, palette] of Object.entries(themes.default)) {
    if (paletteName.startsWith('on-')) {
        continue;
    }
    const inks = generateContrasts(palette);
    const overrides = themes.default[`on-${paletteName}`] ?? {};

    for (const [hue, background] of Object.entries(palette)) {
        if (!/^\d+$/.test(hue)) {
            continue;
        }
        const ink = overrides[hue] ?? inks[hue];
        const ratio = chroma.contrast(background, ink);
        checked++;
        if (ratio < MIN_CONTRAST) {
            failures++;
            console.error(
                `  ✗ ${paletteName}-${hue}: ${background} on ${ink} = ${ratio.toFixed(2)}:1 (needs ${MIN_CONTRAST})`
            );
        }
    }
}

if (failures > 0) {
    console.error(
        `\ncheck-contrast: ${failures} of ${checked} palette pairs fail WCAG AA.\n` +
            'Fix the palette in tailwind.config.js, or the ink rule in ' +
            'src/@fuse/tailwind/utils/generate-contrasts.js.'
    );
    process.exit(1);
}

console.log(`check-contrast: ${checked} palette pairs ≥ ${MIN_CONTRAST}:1 ✓`);
