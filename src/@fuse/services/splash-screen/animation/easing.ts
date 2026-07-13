import type { EasingFunction } from './types';

/**
 * Hand-rolled easing functions — no dependencies. All take and return
 * normalized progress in [0, 1].
 */

export const linear: EasingFunction = (t) => t;

export const easeInQuad: EasingFunction = (t) => t * t;

export const easeOutQuad: EasingFunction = (t) => t * (2 - t);

export const easeInOutQuad: EasingFunction = (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const easeOutCubic: EasingFunction = (t) => 1 - Math.pow(1 - t, 3);

export const easeOutExpo: EasingFunction = (t) =>
    t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);

/** Slight overshoot-and-settle; used for the logo icon "snap" into place. */
export const easeOutBack: EasingFunction = (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
