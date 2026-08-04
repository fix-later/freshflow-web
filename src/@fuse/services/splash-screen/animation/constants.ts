/** Overlay fade duration once the app is ready (milliseconds, WAAPI). */
export const TIMINGS = {
    exitMs: 400,
    exitReducedMs: 200,
} as const;

/** CSS class flagging that the TS module drives the splash lifecycle. */
export const ACTIVE_CLASS = 'ff-splash-active';

/** Body class Fuse adds when the Angular app is ready (first navigation). */
export const APP_READY_CLASS = 'fuse-splash-screen-hidden';
