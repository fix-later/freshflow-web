/**
 * Shared contracts of the splash animation engine.
 */

/** Properties the animator knows how to write to an SVG element. */
export type AnimatableProperty =
    | 'opacity'
    | 'translateX'
    | 'translateY'
    | 'scale'
    | 'scaleX'
    | 'scaleY'
    | 'rotation'
    | 'fillOpacity'
    | 'strokeOpacity';

export type EasingFunction = (t: number) => number;

/**
 * One keyframe pair on the timeline — the splash equivalent of a Lottie
 * keyframe segment: a single property of a single target interpolated
 * between two values over a time window.
 */
export interface AnimationClip {
    /** Registered id of the SVG element this clip drives. */
    targetId: string;
    property: AnimatableProperty;
    from: number;
    to: number;
    /** Seconds on the master timeline. */
    startTime: number;
    endTime: number;
    /** Defaults to linear when omitted. */
    easing?: EasingFunction;
}

/** Mutable per-target value store the animator writes into every frame. */
export type PropertyValues = Record<AnimatableProperty, number>;

export function createDefaultValues(): PropertyValues {
    return {
        opacity: 1,
        translateX: 0,
        translateY: 0,
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        fillOpacity: 1,
        strokeOpacity: 1,
    };
}
