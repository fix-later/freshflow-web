/**
 * Resolves once the FreshFlow splash screen is fully gone — the app is ready
 * (Fuse adds `.fuse-splash-screen-hidden` to `<body>`) AND the splash
 * has finished its exit (its `.ff-splash-active` flag on `<fuse-splash-screen>`
 * has been cleared in the splash lifecycle's `destroy()`).
 *
 * Page chrome that must only appear after the splash — auto-opened dialogs and
 * the like — can await this so it never surfaces underneath or during the
 * splash. Mirrors the condition used by the splash scroll-lock styles.
 */
export function whenSplashHidden(): Promise<void> {
    const isDone = (): boolean =>
        document.body.classList.contains('fuse-splash-screen-hidden') &&
        !document.querySelector('fuse-splash-screen.ff-splash-active');

    if (isDone()) {
        return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
        const finish = (): void => {
            observer.disconnect();
            clearTimeout(fallback);
            resolve();
        };

        const observer = new MutationObserver(() => {
            if (isDone()) {
                finish();
            }
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
            childList: true,
            subtree: true,
        });

        // Safety net: never leave the awaiting chrome permanently blocked if
        // the splash lifecycle somehow doesn't reach its cleared state.
        const fallback = setTimeout(finish, 8000);
    });
}
