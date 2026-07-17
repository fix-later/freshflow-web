import {
    Directive,
    ElementRef,
    OnDestroy,
    OnInit,
    inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

/** Page-transition duration (ms) — long enough for the reveal to read clearly. */
const ROUTE_ANIMATION_DURATION = 650;

/** Ease-out-expo: fast start, long gentle settle — a smooth, premium feel. */
const ROUTE_ANIMATION_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * Shared page-transition animation for router outlets.
 *
 * Applied to a layout's `<router-outlet>`, it fades and lifts each newly
 * activated page into place on navigation, giving every route the same
 * enter animation. Angular inserts the routed component as the outlet
 * element's next sibling, so that sibling is the page host to animate.
 *
 * Uses the Web Animations API (matching @fuse/animations) rather than the
 * classic @angular/animations triggers, so it needs no extra providers and
 * works with lazy-loaded routes.
 *
 * Usage:
 *     <router-outlet fuseRouteAnimation></router-outlet>
 */
@Directive({
    selector: 'router-outlet[fuseRouteAnimation]',
    standalone: true,
})
export class FuseRouteAnimationDirective implements OnInit, OnDestroy {
    private readonly _outlet = inject(RouterOutlet);
    private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly _unsubscribeAll = new Subject<void>();

    ngOnInit(): void {
        this._outlet.activateEvents
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this._animate());
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    /** Play the enter animation on the just-activated page host. */
    private _animate(): void {
        // Respect users who prefer reduced motion.
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const host = this._elementRef.nativeElement
            .nextElementSibling as HTMLElement | null;
        if (!host) {
            return;
        }

        host.animate(
            [
                {
                    opacity: 0,
                    transform: 'translateY(24px) scale(0.985)',
                    filter: 'blur(6px)',
                },
                {
                    opacity: 1,
                    transform: 'translateY(0) scale(1)',
                    filter: 'blur(0)',
                },
            ],
            {
                duration: ROUTE_ANIMATION_DURATION,
                easing: ROUTE_ANIMATION_EASING,
                fill: 'both',
            }
        );
    }
}
