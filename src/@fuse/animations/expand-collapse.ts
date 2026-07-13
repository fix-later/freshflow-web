import { AnimationCallbackEvent } from '@angular/core';
import {
    FuseAnimationCurves,
    FuseAnimationDurations,
} from '@fuse/animations/defaults';

const expandCollapseTiming: EffectTiming = {
    duration: parseFloat(FuseAnimationDurations.entering),
    easing: FuseAnimationCurves.deceleration,
};

// -----------------------------------------------------------------------------------------------------
// @ Expand / collapse
//
// Web Animations API helpers for Angular's `(animate.enter)` / `(animate.leave)` event bindings.
// Height cannot be animated to `auto` with plain CSS classes, so the target height is measured
// at runtime and animated imperatively.
//
// Usage:
//     <div (animate.enter)="expandOnEnter($event)" (animate.leave)="collapseOnLeave($event)">
// -----------------------------------------------------------------------------------------------------

/**
 * Expand the entering element from zero height to its natural height.
 */
export function expandOnEnter(event: AnimationCallbackEvent): void {
    const element = event.target as HTMLElement;
    const previousOverflow = element.style.overflow;

    element.style.overflow = 'hidden';

    const animation = element.animate(
        { height: ['0px', `${element.scrollHeight}px`] },
        expandCollapseTiming
    );

    const complete = (): void => {
        element.style.overflow = previousOverflow;
        event.animationComplete();
    };

    animation.onfinish = complete;
    animation.oncancel = complete;
}

/**
 * Collapse the leaving element from its natural height to zero, then let Angular remove it.
 */
export function collapseOnLeave(event: AnimationCallbackEvent): void {
    const element = event.target as HTMLElement;

    element.style.overflow = 'hidden';

    const animation = element.animate(
        { height: [`${element.scrollHeight}px`, '0px'] },
        { ...expandCollapseTiming, fill: 'forwards' }
    );

    animation.onfinish = (): void => event.animationComplete();
    animation.oncancel = (): void => event.animationComplete();
}
