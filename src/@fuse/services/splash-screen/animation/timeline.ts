import type { AnimationClip } from './types';

/**
 * The declarative heart of the system: a flat, immutable-after-build list
 * of keyframe clips, exactly like a (very) simplified Lottie composition.
 *
 * The timeline knows nothing about SVG or time sources — it only stores
 * clips. Adding a new animation means inserting another clip; the engine
 * never changes.
 */
export class Timeline {
    private readonly _clips: AnimationClip[] = [];
    private _duration = 0;
    private _sorted = false;

    /** Appends one clip. Chainable so storyboards read top-to-bottom. */
    add(clip: AnimationClip): this {
        this._clips.push(clip);
        this._duration = Math.max(this._duration, clip.endTime);
        this._sorted = false;
        return this;
    }

    /**
     * Clips ordered by start time. Later clips override earlier ones on
     * the same target/property, which is what makes sequencing (drift leg
     * after fade-in, converge after drift) fall out of plain data.
     */
    get clips(): readonly AnimationClip[] {
        if (!this._sorted) {
            this._clips.sort((a, b) => a.startTime - b.startTime);
            this._sorted = true;
        }
        return this._clips;
    }

    /** Timeline length in seconds (end of the latest clip). */
    get duration(): number {
        return this._duration;
    }

    /** Extends the duration past the last clip (calm hold at the end). */
    holdUntil(time: number): this {
        this._duration = Math.max(this._duration, time);
        return this;
    }
}
