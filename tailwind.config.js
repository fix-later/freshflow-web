const path = require('path');
const colors = require('tailwindcss/colors');
const defaultTheme = require('tailwindcss/defaultTheme');
const generatePalette = require(
    path.resolve(__dirname, 'src/@fuse/tailwind/utils/generate-palette')
);

/**
 * Brand palettes — the ONLY source of brand color in the app.
 *
 * `generatePalette` expands each anchor into a full Tailwind-style ramp; the
 * Fuse theming plugin (bottom of this file) then derives BOTH the Tailwind
 * utilities (`bg-primary`, `text-on-primary`) AND the Material theme + CSS
 * variables (`--fuse-primary*`) from it, by writing
 * `src/@fuse/styles/user-themes.scss`. That file is GENERATED — never hand-edit
 * it, the next build overwrites it. Change color here and nowhere else.
 *
 * Palette per `specs/design/TOKENS.md`: primary FreshFlow navy, secondary
 * (Material calls that slot `accent`) FreshFlow mint, warn red, plus `sale`
 * for discounted prices.
 *
 * Navy does the work — headings, prices, primary actions — and mint is the
 * sparing highlight, the ratio the storefront reference uses (~8:1). Mint as
 * primary put #50F0A3 text on white at ~1.5:1 contrast, failing WCAG AA;
 * navy on white reads ~10:1.
 *
 * `sale` is a real palette rather than a one-off hex so the discount color is
 * a token like every other. The theming plugin derives Tailwind utilities
 * (`text-sale`) and CSS variables from any key here; Material only consumes
 * primary/accent/warn, so the extra palette costs it nothing.
 */
const customPalettes = {
    freshflowNavy: generatePalette({ 500: '#313F90', 600: '#2C3881' }),
    freshflowMint: generatePalette({ 500: '#50F0A3', 600: '#48D892' }),
    freshflowSale: generatePalette({ 500: '#F0508A', 600: '#DC3F7B' }),
};

/**
 * Themes
 *
 * Exactly one theme ships. The five Fuse demo themes (brand/teal/rose/purple/
 * amber) were removed: nothing could reach them once the theme-picker drawer
 * was deleted, and each one emitted ~148 KB of unreachable CSS.
 *
 * Chrome is chosen per area via `data: { theme }` in `app.routes.ts` (see
 * specs/ux/NAVIGATION.md § Layout per area). To give an area its own palette,
 * add a theme here — the plugin generates its `.theme-*` class — and point
 * that route block's `data.theme` at it.
 */
const themes = {
    // Default theme is required for theming system to work correctly!
    default: {
        primary: {
            ...customPalettes.freshflowNavy,
            DEFAULT: customPalettes.freshflowNavy[500],
        },
        accent: {
            ...customPalettes.freshflowMint,
            DEFAULT: customPalettes.freshflowMint[500],
        },
        warn: {
            ...colors.red,
            DEFAULT: colors.red[600],
        },
        // No `on-warn` override: it used to pin red-50 as the ink on red, which
        // measured 4.41:1 — below AA. `generateContrasts` now enforces the floor
        // for every palette, so the generated value (4.83:1) is the better one.
        sale: {
            ...customPalettes.freshflowSale,
            DEFAULT: customPalettes.freshflowSale[500],
        },
    },
};

/**
 * Tailwind configuration
 */
const config = {
    darkMode: 'class',
    content: ['./src/**/*.{html,scss,ts}'],
    important: true,
    theme: {
        fontSize: {
            xs: '0.625rem',
            sm: '0.75rem',
            md: '0.8125rem',
            base: '0.875rem',
            lg: '1rem',
            xl: '1.125rem',
            '2xl': '1.25rem',
            '3xl': '1.5rem',
            '4xl': '2rem',
            '5xl': '2.25rem',
            '6xl': '2.5rem',
            '7xl': '3rem',
            '8xl': '4rem',
            '9xl': '6rem',
            '10xl': '8rem',
        },
        screens: {
            sm: '600px',
            md: '960px',
            lg: '1280px',
            xl: '1440px',
        },
        extend: {
            animation: {
                'spin-slow': 'spin 3s linear infinite',
            },
            colors: {
                gray: colors.slate,
            },
            flex: {
                0: '0 0 auto',
            },
            fontFamily: {
                sans: `"Google Sans Flex", ${defaultTheme.fontFamily.sans.join(',')}`,
                mono: `"IBM Plex Mono", ${defaultTheme.fontFamily.mono.join(',')}`,
            },
            opacity: {
                12: '0.12',
                38: '0.38',
                87: '0.87',
            },
            rotate: {
                '-270': '270deg',
                15: '15deg',
                30: '30deg',
                60: '60deg',
                270: '270deg',
            },
            scale: {
                '-1': '-1',
            },
            zIndex: {
                '-1': -1,
                49: 49,
                60: 60,
                70: 70,
                80: 80,
                90: 90,
                99: 99,
                999: 999,
                9999: 9999,
                99999: 99999,
            },
            spacing: {
                13: '3.25rem',
                15: '3.75rem',
                18: '4.5rem',
                22: '5.5rem',
                26: '6.5rem',
                30: '7.5rem',
                50: '12.5rem',
                90: '22.5rem',

                // Bigger values
                100: '25rem',
                120: '30rem',
                128: '32rem',
                140: '35rem',
                160: '40rem',
                180: '45rem',
                192: '48rem',
                200: '50rem',
                240: '60rem',
                256: '64rem',
                280: '70rem',
                320: '80rem',
                360: '90rem',
                400: '100rem',
                480: '120rem',

                // Fractional values
                '1/2': '50%',
                '1/3': '33.333333%',
                '2/3': '66.666667%',
                '1/4': '25%',
                '2/4': '50%',
                '3/4': '75%',
            },
            minHeight: ({ theme }) => ({
                ...theme('spacing'),
            }),
            maxHeight: {
                none: 'none',
            },
            minWidth: ({ theme }) => ({
                ...theme('spacing'),
                screen: '100vw',
            }),
            maxWidth: ({ theme }) => ({
                ...theme('spacing'),
                screen: '100vw',
            }),
            transitionDuration: {
                400: '400ms',
            },
            transitionTimingFunction: {
                drawer: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
            },

            // @tailwindcss/typography
            typography: ({ theme }) => ({
                DEFAULT: {
                    css: {
                        color: 'var(--fuse-text-default)',
                        '[class~="lead"]': {
                            color: 'var(--fuse-text-secondary)',
                        },
                        a: {
                            color: 'var(--fuse-primary-500)',
                        },
                        strong: {
                            color: 'var(--fuse-text-default)',
                        },
                        'ol > li::before': {
                            color: 'var(--fuse-text-secondary)',
                        },
                        'ul > li::before': {
                            backgroundColor: 'var(--fuse-text-hint)',
                        },
                        hr: {
                            borderColor: 'var(--fuse-border)',
                        },
                        blockquote: {
                            color: 'var(--fuse-text-default)',
                            borderLeftColor: 'var(--fuse-border)',
                        },
                        h1: {
                            color: 'var(--fuse-text-default)',
                        },
                        h2: {
                            color: 'var(--fuse-text-default)',
                        },
                        h3: {
                            color: 'var(--fuse-text-default)',
                        },
                        h4: {
                            color: 'var(--fuse-text-default)',
                        },
                        'figure figcaption': {
                            color: 'var(--fuse-text-secondary)',
                        },
                        code: {
                            color: 'var(--fuse-text-default)',
                            fontWeight: '500',
                        },
                        'a code': {
                            color: 'var(--fuse-primary)',
                        },
                        pre: {
                            color: theme('colors.white'),
                            backgroundColor: theme('colors.gray.800'),
                        },
                        thead: {
                            color: 'var(--fuse-text-default)',
                            borderBottomColor: 'var(--fuse-border)',
                        },
                        'tbody tr': {
                            borderBottomColor: 'var(--fuse-border)',
                        },
                        'ol[type="A" s]': false,
                        'ol[type="a" s]': false,
                        'ol[type="I" s]': false,
                        'ol[type="i" s]': false,
                    },
                },
                sm: {
                    css: {
                        code: {
                            fontSize: '1em',
                        },
                        pre: {
                            fontSize: '1em',
                        },
                        table: {
                            fontSize: '1em',
                        },
                    },
                },
            }),
        },
    },
    corePlugins: {
        appearance: false,
        container: false,
        float: false,
        clear: false,
        placeholderColor: false,
        placeholderOpacity: false,
        verticalAlign: false,
    },
    plugins: [
        // Fuse - Tailwind plugins
        require(
            path.resolve(__dirname, 'src/@fuse/tailwind/plugins/utilities')
        ),
        require(
            path.resolve(__dirname, 'src/@fuse/tailwind/plugins/icon-size')
        ),
        require(path.resolve(__dirname, 'src/@fuse/tailwind/plugins/theming'))({
            themes,
        }),

        // Other third party and/or custom plugins
        require('@tailwindcss/typography')({ modifiers: ['sm', 'lg'] }),
    ],
};

module.exports = config;

/**
 * The palettes, exposed for `scripts/check-contrast.mjs` (run by `precheck`) so
 * the contrast guard reads the same source Tailwind does instead of a copy that
 * could drift. Tailwind ignores unknown top-level keys.
 */
module.exports.__themes = themes;
