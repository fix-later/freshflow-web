import { EASING, LOGO, STAGE, TIMINGS } from './constants';
import type { LetterSlot } from './logo';
import { Timeline } from './timeline';

/**
 * The whole storyboard as plain timeline data. Adding another animation
 * is inserting another clip — the engine never changes.
 */
export function buildTimeline(letters: readonly LetterSlot[]): Timeline {
    const tl = new Timeline();
    const t = TIMINGS;

    // 1. The logo icon materializes, settling with a slight overshoot.
    tl.add({
        targetId: 'icon',
        property: 'opacity',
        from: 0,
        to: 1,
        startTime: t.iconReveal.start,
        endTime: t.iconReveal.start + t.iconReveal.duration * 0.7,
        easing: EASING.iconFade,
    }).add({
        targetId: 'icon',
        property: 'scale',
        from: 0.82,
        to: 1,
        startTime: t.iconReveal.start,
        endTime: t.iconReveal.start + t.iconReveal.duration,
        easing: EASING.iconScale,
    });

    // 2. Letters pop in one by one, left to right, rising into place.
    letters.forEach((letter, index) => {
        const start =
            t.wordmarkReveal.start + index * t.wordmarkReveal.perLetter;
        const end = start + t.wordmarkReveal.letterDuration;
        pinLetterX(tl, letter);
        tl.add({
            targetId: letter.id,
            property: 'opacity',
            from: 0,
            to: 1,
            startTime: start,
            endTime: end,
            easing: EASING.letterFade,
        }).add({
            targetId: letter.id,
            property: 'translateY',
            from: letter.centerY + LOGO.letterRise,
            to: letter.centerY,
            startTime: start,
            endTime: end,
            easing: EASING.letterRise,
        });
    });

    // 3. Hold — the timeline runs on past the last clip.
    return tl.holdUntil(t.total);
}

/**
 * Exit choreography, played by a second Animator pass once the app is
 * ready: letters close one by one (right to left, unwinding the entrance),
 * lifting straight up as they fade, while the icon zooms toward the
 * viewer and dissolves.
 */
export function buildExitTimeline(letters: readonly LetterSlot[]): Timeline {
    const tl = new Timeline();
    const t = TIMINGS;

    [...letters].reverse().forEach((letter, index) => {
        const start = t.exitWordmark.start + index * t.exitWordmark.perLetter;
        const end = start + t.exitWordmark.letterDuration;
        pinLetterX(tl, letter);
        tl.add({
            targetId: letter.id,
            property: 'opacity',
            from: 1,
            to: 0,
            startTime: start,
            endTime: end,
            easing: EASING.exit,
        }).add({
            targetId: letter.id,
            property: 'translateY',
            from: letter.centerY,
            to: letter.centerY + LOGO.letterRise,
            startTime: start,
            endTime: end,
            easing: EASING.exit,
        });
    });

    tl.add({
        targetId: 'icon',
        property: 'scale',
        from: 1,
        to: 1.18,
        startTime: t.exitIcon.start,
        endTime: t.exitIcon.start + t.exitIcon.duration,
        easing: EASING.exit,
    }).add({
        targetId: 'icon',
        property: 'opacity',
        from: 1,
        to: 0,
        startTime: t.exitIcon.start,
        endTime: t.exitIcon.start + t.exitIcon.duration,
        easing: EASING.exit,
    });

    pinStaticPositions(tl);
    return tl;
}

/** Zero-length clip holding a letter at its horizontal slot. */
function pinLetterX(tl: Timeline, letter: LetterSlot): void {
    tl.add({
        targetId: letter.id,
        property: 'translateX',
        from: letter.centerX,
        to: letter.centerX,
        startTime: 0,
        endTime: 0,
    });
}

/**
 * Fixed translate components the animator would otherwise reset: the icon
 * never moves, so its static position is expressed as zero-length clips.
 */
export function pinStaticPositions(tl: Timeline): void {
    tl.add({
        targetId: 'icon',
        property: 'translateX',
        from: STAGE.centerX,
        to: STAGE.centerX,
        startTime: 0,
        endTime: 0,
    }).add({
        targetId: 'icon',
        property: 'translateY',
        from: LOGO.iconCenterY,
        to: LOGO.iconCenterY,
        startTime: 0,
        endTime: 0,
    });
}
