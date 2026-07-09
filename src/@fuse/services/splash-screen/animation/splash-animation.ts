import { Animator } from './animator';
import { ACTIVE_CLASS, APP_READY_CLASS, TIMINGS } from './constants';
import { buildScene, SplashScene } from './logo';
import {
    buildExitTimeline,
    buildTimeline,
    pinStaticPositions,
} from './storyboard';

/**
 * Lifecycle owner. Mounts the SVG scene into `<fuse-splash-screen>`,
 * plays the timeline, and exits once BOTH the sequence has finished AND
 * Angular reports ready (Fuse adds `fuse-splash-screen-hidden` to <body>).
 * A pure-CSS fallback still hides the splash if this module never runs.
 */
export class SplashScreen {
    private static instance: SplashScreen | null = null;

    private animator: Animator | null = null;
    private scene: SplashScene | null = null;
    private observer: MutationObserver | null = null;
    private floatAnimation: Animation | null = null;

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

        this.scene = buildScene(host);
        const timeline = buildTimeline(this.scene.letters);
        pinStaticPositions(timeline);

        this.animator = new Animator(timeline);
        for (const [id, element] of this.scene.targets) {
            this.animator.register(id, element);
        }

        const reduce = window.matchMedia?.(
            '(prefers-reduced-motion: reduce)'
        ).matches;
        if (reduce) {
            this.animator.seek(timeline.duration);
            void this.whenAppReady().then(() =>
                this.exit(TIMINGS.exitReducedMs)
            );
            return;
        }

        const played = this.animator.play().then(() => this.startFloat());
        void Promise.all([played, this.whenAppReady()]).then(() =>
            this.playExit()
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

    /** Calm hold: a barely-there float on the finished lockup. */
    private startFloat(): void {
        if (!this.scene) {
            return;
        }
        this.floatAnimation = this.scene.svg.animate(
            [
                { transform: 'translateY(0px)' },
                { transform: 'translateY(4px)' },
            ],
            {
                duration: TIMINGS.floatMs,
                direction: 'alternate',
                iterations: Infinity,
                easing: 'ease-in-out',
            }
        );
    }

    /**
     * Choreographed disappearance: letters close one by one and the icon
     * zooms away while the overlay itself fades to reveal the app.
     */
    private playExit(): void {
        if (!this.scene) {
            return;
        }
        this.floatAnimation?.cancel();
        const exitAnimator = new Animator(
            buildExitTimeline(this.scene.letters)
        );
        for (const [id, element] of this.scene.targets) {
            exitAnimator.register(id, element);
        }
        const logoOut = exitAnimator.play();
        const fade = this.host.animate([{ opacity: 1 }, { opacity: 0 }], {
            delay: TIMINGS.exitFadeDelayMs,
            duration: TIMINGS.exitMs,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'forwards',
        });
        void Promise.all([logoOut, fade.finished.catch(() => undefined)]).then(
            () => this.destroy()
        );
    }

    /** Plain quick fade — the reduced-motion exit. */
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
        this.animator?.stop();
        this.floatAnimation?.cancel();
        this.scene?.svg.remove();
        // Hand the element back to the stock CSS lifecycle (hidden state).
        this.host.classList.remove(ACTIVE_CLASS);
        SplashScreen.instance = null;
    }
}

/** Convenience wrapper used by main.ts. */
export function initSplashScreen(): SplashScreen | null {
    return SplashScreen.init();
}
