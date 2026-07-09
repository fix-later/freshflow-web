import { easeInQuad, easeOutBack, easeOutCubic, easeOutQuad } from './easing';

/**
 * Every tunable of the splash — colors, geometry, timings, easing — lives
 * here so the sequence can be re-art-directed without touching the engine
 * or the storyboard code.
 */

export const COLORS = {
    background: '#083B4B',
} as const;

/**
 * The scene uses a fixed 1000×1000 viewBox centered on (500, 500) and
 * scales with the viewport via preserveAspectRatio — no resize handling.
 */
export const STAGE = {
    size: 1000,
    centerX: 500,
    centerY: 500,
} as const;

export const LOGO = {
    iconUrl: 'images/logo/logo-dark.svg',
    wordmarkUrl: 'images/logo/logo-secondary-dark.svg',
    /** Icon square, centered slightly above stage center (viewBox units). */
    iconSize: 150,
    iconCenterY: 435,
    /** Intrinsic size of the assembled wordmark (letter-asset units). */
    wordmarkViewBox: { width: 591, height: 128 },
    /** Rendered wordmark width (viewBox units). */
    wordmarkWidth: 400,
    /** Vertical gap between icon and wordmark (viewBox units). */
    lockupGap: 50,
    /** How far each letter rises into place (wordmark-intrinsic units). */
    letterRise: 20,
} as const;

/**
 * The wordmark letters, one SVG asset each, in reading order. Widths and
 * heights are the assets' intrinsic sizes; letters are laid out on a
 * shared baseline with `LETTER_SPACING` between them.
 */
export const LETTERS = [
    { src: 'images/splashscreen/f.svg', width: 41, height: 92 },
    { src: 'images/splashscreen/r.svg', width: 50, height: 68 },
    { src: 'images/splashscreen/e.svg', width: 72, height: 70 },
    { src: 'images/splashscreen/s.svg', width: 58, height: 71 },
    { src: 'images/splashscreen/h.svg', width: 61, height: 90 },
    { src: 'images/splashscreen/f.svg', width: 41, height: 92 },
    { src: 'images/splashscreen/l.svg', width: 15, height: 90 },
    { src: 'images/splashscreen/o.svg', width: 75, height: 71 },
    { src: 'images/splashscreen/w.svg', width: 134, height: 127 },
] as const;

/** Horizontal gap between letters (letter-asset units). */
export const LETTER_SPACING = 5.5;

/** Master storyboard beats (seconds). */
export const TIMINGS = {
    iconReveal: { start: 0.2, duration: 0.6 },
    /** Letters pop in one by one, left to right. */
    wordmarkReveal: { start: 0.65, perLetter: 0.05, letterDuration: 0.32 },
    /** Timeline end — includes the calm hold. */
    total: 2.4,
    /** Exit: letters close one by one (right to left), icon zooms away. */
    exitWordmark: { start: 0, perLetter: 0.035, letterDuration: 0.22 },
    exitIcon: { start: 0.3, duration: 0.4 },
    /** Overlay fade starts this far into the exit (milliseconds, WAAPI). */
    exitFadeDelayMs: 350,
    /** Overlay fade duration (milliseconds, WAAPI). */
    exitMs: 450,
    exitReducedMs: 250,
    /** Idle float loop after the sequence finishes (milliseconds, WAAPI). */
    floatMs: 2600,
} as const;

/** Art-directed easing per storyboard beat. */
export const EASING = {
    iconScale: easeOutBack,
    iconFade: easeOutQuad,
    letterFade: easeOutQuad,
    letterRise: easeOutCubic,
    /** Exit motions accelerate away — the inverse feel of the entrance. */
    exit: easeInQuad,
} as const;

/** Derived layout: the wordmark group's origin at the lockup's left edge. */
export const WORDMARK_POS = {
    left: STAGE.centerX - LOGO.wordmarkWidth / 2,
    top: LOGO.iconCenterY + LOGO.iconSize / 2 + LOGO.lockupGap,
} as const;

/** CSS class flagging that the TS module drives the splash lifecycle. */
export const ACTIVE_CLASS = 'ff-splash-active';

/** Body class Fuse adds when the Angular app is ready (first navigation). */
export const APP_READY_CLASS = 'fuse-splash-screen-hidden';
