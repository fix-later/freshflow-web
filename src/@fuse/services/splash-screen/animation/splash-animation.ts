import { ACTIVE_CLASS, APP_READY_CLASS, TIMINGS } from './constants';

/**
 * Lifecycle owner. Marks `<fuse-splash-screen>` active and fades it out once
 * Angular reports ready (Fuse adds `fuse-splash-screen-hidden` to <body>).
 * A pure-CSS fallback still hides the splash if this module never runs.
 */
export class SplashScreen {
    private static instance: SplashScreen | null = null;

    private observer: MutationObserver | null = null;

    static init(): SplashScreen | null {
        if (SplashScreen.instance) {
            return SplashScreen.instance;
        }
        const host = document.querySelector<HTMLElement>('fuse-splash-screen');
        if (!host) {
            return null;
        }
        SplashScreen.instance = new SplashScreen(host);
        return SplashScreen.instance;
    }

    private constructor(private readonly host: HTMLElement) {
        host.classList.add(ACTIVE_CLASS);

        const reduce = window.matchMedia?.(
            '(prefers-reduced-motion: reduce)'
        ).matches;
        void this.whenAppReady().then(() =>
            this.exit(reduce ? TIMINGS.exitReducedMs : TIMINGS.exitMs)
        );
    }

    /** Resolves when Fuse marks the app ready via the body class. */
    private whenAppReady(): Promise<void> {
        if (document.body.classList.contains(APP_READY_CLASS)) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.observer = new MutationObserver(() => {
                if (document.body.classList.contains(APP_READY_CLASS)) {
                    this.observer?.disconnect();
                    this.observer = null;
                    resolve();
                }
            });
            this.observer.observe(document.body, {
                attributes: true,
                attributeFilter: ['class'],
            });
        });
    }

    private exit(durationMs: number): void {
        const fade = this.host.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: durationMs,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'forwards',
        });
        fade.finished.then(() => this.destroy()).catch(() => this.destroy());
    }

    private destroy(): void {
        this.observer?.disconnect();
        this.host.classList.remove(ACTIVE_CLASS);
        SplashScreen.instance = null;
    }
}

/** Convenience wrapper used by main.ts. */
export function initSplashScreen(): SplashScreen | null {
    return SplashScreen.init();
}
