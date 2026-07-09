import { Timeline } from './timeline';
import type { AnimatableProperty, PropertyValues } from './types';
import { createDefaultValues } from './types';

// ---------------------------------------------------------------------
// Interpolation math — implemented manually, no libraries.
// ---------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}

export function lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t;
}

export function inverseLerp(from: number, to: number, value: number): number {
    return from === to ? 1 : (value - from) / (to - from);
}

/** Shared frame-reset source — assigned from, never mutated. */
const DEFAULTS: Readonly<PropertyValues> = createDefaultValues();

/** A registered SVG element plus its cached, mutable property values. */
interface Target {
    element: SVGElement;
    values: PropertyValues;
    /**
     * Resting pose: for every property this target animates, the `from`
     * of its earliest clip (Lottie semantics — the first keyframe value
     * holds before its window starts). Filled in by `prepare()`.
     */
    initial: Partial<PropertyValues>;
    lastTransform: string;
    lastOpacity: number;
    lastFillOpacity: number;
    lastStrokeOpacity: number;
}

/**
 * The player: one requestAnimationFrame loop that walks the timeline,
 * interpolates every clip whose window has started (finished clips hold
 * their end value) and writes the results to the SVG DOM.
 *
 * Element references, value records and initial poses are prepared once —
 * the per-frame path performs no queries and no allocations beyond the
 * composed transform strings.
 */
export class Animator {
    private readonly targets = new Map<string, Target>();
    private rafId = 0;
    private startStamp = 0;
    private playing = false;
    private prepared = false;

    constructor(private readonly timeline: Timeline) {}

    /** Registers an element under an id that clips can refer to. */
    register(id: string, element: SVGElement): void {
        this.targets.set(id, {
            element,
            values: createDefaultValues(),
            initial: {},
            lastTransform: '',
            lastOpacity: -1,
            lastFillOpacity: -1,
            lastStrokeOpacity: -1,
        });
    }

    /** Plays the timeline once; resolves when its duration has elapsed. */
    play(): Promise<void> {
        return new Promise((resolve) => {
            this.playing = true;
            this.startStamp = performance.now();
            const frame = (now: number): void => {
                if (!this.playing) {
                    resolve();
                    return;
                }
                const time = (now - this.startStamp) / 1000;
                this.update(time);
                if (time >= this.timeline.duration) {
                    this.playing = false;
                    resolve();
                    return;
                }
                this.rafId = requestAnimationFrame(frame);
            };
            this.rafId = requestAnimationFrame(frame);
        });
    }

    /** Renders the state at `time` without playing — e.g. jump to the end. */
    seek(time: number): void {
        this.update(time);
    }

    stop(): void {
        this.playing = false;
        cancelAnimationFrame(this.rafId);
    }

    /**
     * One frame: reset every target to its resting pose, replay started
     * clips in start order (later clips override earlier ones on the same
     * property — sequencing falls out of plain data), then flush to DOM.
     */
    private update(time: number): void {
        if (!this.prepared) {
            this.prepare();
        }

        for (const target of this.targets.values()) {
            Object.assign(target.values, DEFAULTS, target.initial);
        }

        for (const clip of this.timeline.clips) {
            if (time < clip.startTime) {
                break; // Sorted: nothing later has started either.
            }
            const target = this.targets.get(clip.targetId);
            if (!target) {
                continue;
            }
            const raw = clamp(
                inverseLerp(clip.startTime, clip.endTime, time),
                0,
                1
            );
            const eased = clip.easing ? clip.easing(raw) : raw;
            target.values[clip.property] = lerp(clip.from, clip.to, eased);
        }

        for (const target of this.targets.values()) {
            this.flush(target);
        }
    }

    /** Records each target's resting pose from its earliest clips. */
    private prepare(): void {
        const seen = new Set<string>();
        for (const clip of this.timeline.clips) {
            const key = `${clip.targetId}:${clip.property}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            const target = this.targets.get(clip.targetId);
            if (target) {
                target.initial[clip.property as AnimatableProperty] = clip.from;
            }
        }
        this.prepared = true;
    }

    /** Writes values as SVG attributes, skipping unchanged strings. */
    private flush(target: Target): void {
        const v = target.values;
        const sx = v.scale * v.scaleX;
        const sy = v.scale * v.scaleY;
        const transform =
            `translate(${v.translateX} ${v.translateY})` +
            ` rotate(${v.rotation}) scale(${sx} ${sy})`;
        if (transform !== target.lastTransform) {
            target.element.setAttribute('transform', transform);
            target.lastTransform = transform;
        }
        if (v.opacity !== target.lastOpacity) {
            target.element.setAttribute('opacity', String(v.opacity));
            target.lastOpacity = v.opacity;
        }
        if (v.fillOpacity !== target.lastFillOpacity) {
            target.element.setAttribute('fill-opacity', String(v.fillOpacity));
            target.lastFillOpacity = v.fillOpacity;
        }
        if (v.strokeOpacity !== target.lastStrokeOpacity) {
            target.element.setAttribute(
                'stroke-opacity',
                String(v.strokeOpacity)
            );
            target.lastStrokeOpacity = v.strokeOpacity;
        }
    }
}
