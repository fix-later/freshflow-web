import { NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    TemplateRef,
    ViewEncapsulation,
    computed,
    contentChild,
    effect,
    inject,
    input,
    signal,
    untracked,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@jsverse/transloco';

/** Slide the row rests on before advancing itself. `0` turns autoplay off. */
const DEFAULT_INTERVAL_MS = 4500;

/** Matches the CSS transition on the track; the snap waits this long. */
const SLIDE_DURATION_MS = 420;

/**
 * An infinite, auto-rotating carousel.
 *
 * **Why a template rather than content projection.** The loop is seamless
 * because the head of the list is *cloned* onto the tail: sliding past the last
 * real slide lands on a copy of the first, and the track then snaps back to the
 * real one with the transition off, so the row never rewinds in front of the
 * user. Cloning means rendering the same item twice, which projected content
 * cannot do — so the caller hands over `items` and an `<ng-template>` saying how
 * one is drawn:
 *
 * ```html
 * <ff-carousel [items]="cards()" [perView]="4">
 *     <ng-template let-item>
 *         <ff-product-card [product]="item" />
 *     </ng-template>
 * </ff-carousel>
 * ```
 *
 * Autoplay pauses while a pointer or focus is inside — a slide that walks away
 * from the control being reached for is worse than one that never moved — and
 * is off entirely under `prefers-reduced-motion`, where the arrows also jump
 * instead of animating.
 */
@Component({
    selector: 'ff-carousel',
    templateUrl: './carousel.component.html',
    styleUrl: './carousel.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatIconModule, NgTemplateOutlet, TranslocoModule],
    host: {
        class: 'ff-carousel',
        '(mouseenter)': 'pause(true)',
        '(mouseleave)': 'pause(false)',
        '(focusin)': 'pause(true)',
        '(focusout)': 'pause(false)',
    },
})
export class CarouselComponent<T> {
    private readonly _destroyRef = inject(DestroyRef);

    readonly items = input.required<readonly T[]>();

    /** How many slides share the width. Fractional is fine — `2.5` peeks. */
    readonly perView = input(1);

    /** Milliseconds each slide rests. `0` leaves the row still until driven. */
    readonly interval = input(DEFAULT_INTERVAL_MS);

    /** Dots under the row, one per real slide. */
    readonly showDots = input(true);

    readonly slideTemplate = contentChild.required(TemplateRef);

    /**
     * Which slide leads the row. Runs one past the end while the clone is on
     * screen, which is the moment {@link _snapToReal} then corrects.
     */
    readonly index = signal(0);

    /** Off while the track snaps from a clone back to the real slide. */
    readonly animating = signal(true);

    readonly paused = signal(false);

    /** The real slides plus a cloned head, which is what makes the loop seamless. */
    readonly slides = computed<readonly T[]>(() => {
        const items = this.items();
        if (items.length <= 1) {
            return items;
        }
        return [
            ...items,
            ...items.slice(0, Math.max(1, Math.ceil(this.perView()))),
        ];
    });

    /** Dot for the slide actually on screen — the clone reads as the original. */
    readonly activeDot = computed(() => {
        const count = this.items().length;
        return count ? this.index() % count : 0;
    });

    readonly canLoop = computed(() => this.items().length > 1);

    private _timer: ReturnType<typeof setInterval> | null = null;
    private _snapTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        // Autoplay follows the inputs and the pause state; a list that shrinks
        // to one slide stops the row rather than rotating in place.
        effect(() => {
            const on =
                !this.paused() &&
                this.canLoop() &&
                this.interval() > 0 &&
                !this._reducedMotion();
            const every = this.interval();
            untracked(() => {
                this._stop();
                if (on) {
                    this._timer = setInterval(() => this.next(), every);
                }
            });
        });

        // A changed list invalidates the position it was scrolled to.
        effect(() => {
            this.items();
            untracked(() => this.index.set(0));
        });

        this._destroyRef.onDestroy(() => {
            this._stop();
            if (this._snapTimer) {
                clearTimeout(this._snapTimer);
            }
        });
    }

    /** How far the track is shifted, as a share of one slide's width. */
    readonly offset = computed(() => this.index() * (100 / this.perView()));

    next(): void {
        if (!this.canLoop()) {
            return;
        }
        this.animating.set(!this._reducedMotion());
        this.index.update((value) => value + 1);
        // The slide just moved to may be the cloned head; if so, swap it for
        // the real first slide once the movement has finished.
        if (this.index() >= this.items().length) {
            this._snapToReal(0);
        }
    }

    previous(): void {
        if (!this.canLoop()) {
            return;
        }
        if (this.index() === 0) {
            // Jump to the clone that sits where "before the first" would be,
            // without animating, then slide back to the last real slide.
            this.animating.set(false);
            this.index.set(this.items().length);
            requestAnimationFrame(() => {
                this.animating.set(!this._reducedMotion());
                this.index.update((value) => value - 1);
            });
            return;
        }
        this.animating.set(!this._reducedMotion());
        this.index.update((value) => value - 1);
    }

    goTo(dot: number): void {
        this.animating.set(!this._reducedMotion());
        this.index.set(dot);
    }

    pause(paused: boolean): void {
        this.paused.set(paused);
    }

    /**
     * Waits for the slide to land, then re-points the track at the real slide
     * with the transition off — the swap is invisible because the clone and the
     * slide it replaces are the same picture.
     */
    private _snapToReal(realIndex: number): void {
        if (this._snapTimer) {
            clearTimeout(this._snapTimer);
        }
        this._snapTimer = setTimeout(
            () => {
                this._snapTimer = null;
                this.animating.set(false);
                this.index.set(realIndex);
            },
            this._reducedMotion() ? 0 : SLIDE_DURATION_MS
        );
    }

    private _stop(): void {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    private _reducedMotion(): boolean {
        return (
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
            false
        );
    }
}
