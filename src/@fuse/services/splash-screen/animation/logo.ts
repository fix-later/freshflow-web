import {
    LETTER_SPACING,
    LETTERS,
    LOGO,
    STAGE,
    WORDMARK_POS,
} from './constants';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A placed wordmark letter: its target id and center position. */
export interface LetterSlot {
    id: string;
    /** Letter center in wordmark-intrinsic units — the rotation pivot. */
    centerX: number;
    centerY: number;
}

/** Everything the scene exposes to the storyboard and lifecycle. */
export interface SplashScene {
    svg: SVGSVGElement;
    /** targetId → element, ready for Animator.register. */
    targets: Map<string, SVGElement>;
    /** Wordmark letters, ordered left→right. */
    letters: LetterSlot[];
}

function el<K extends keyof SVGElementTagNameMap>(
    tag: K
): SVGElementTagNameMap[K] {
    return document.createElementNS(SVG_NS, tag);
}

/**
 * Builds the splash SVG once — the logo icon and the wordmark assembled
 * from one SVG asset per letter. Rendering afterwards is exclusively
 * attribute updates performed by the Animator; nothing here is touched
 * again.
 */
export function buildScene(host: HTMLElement): SplashScene {
    const targets = new Map<string, SVGElement>();

    const svg = el('svg');
    svg.setAttribute('class', 'ff-splash-stage');
    svg.setAttribute('viewBox', `0 0 ${STAGE.size} ${STAGE.size}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');

    // Logo icon ------------------------------------------------------
    const icon = el('g');
    const iconHalf = LOGO.iconSize / 2;
    const iconImage = el('image');
    iconImage.setAttribute('href', LOGO.iconUrl);
    iconImage.setAttribute('x', String(-iconHalf));
    iconImage.setAttribute('y', String(-iconHalf));
    iconImage.setAttribute('width', String(LOGO.iconSize));
    iconImage.setAttribute('height', String(LOGO.iconSize));
    icon.appendChild(iconImage);
    // Pre-pose before the animator's first frame: in place, invisible.
    icon.setAttribute(
        'transform',
        `translate(${STAGE.centerX} ${LOGO.iconCenterY})`
    );
    icon.setAttribute('opacity', '0');
    targets.set('icon', icon);
    svg.appendChild(icon);

    // Wordmark ---------------------------------------------------------
    // One <image> per letter, bottom-aligned on a shared baseline. Each
    // image is centered on its own origin and placed via translate, so
    // animated rotation pivots around the letter's center.
    const wordmark = el('g');
    const scale = LOGO.wordmarkWidth / LOGO.wordmarkViewBox.width;
    wordmark.setAttribute(
        'transform',
        `translate(${WORDMARK_POS.left} ${WORDMARK_POS.top}) scale(${scale})`
    );
    svg.appendChild(wordmark);

    const baseline = LOGO.wordmarkViewBox.height;
    const letters: LetterSlot[] = [];
    let cursorX = 0;
    LETTERS.forEach((letter, index) => {
        const centerX = cursorX + letter.width / 2;
        const centerY = baseline - letter.height / 2;
        const image = el('image');
        image.setAttribute('href', letter.src);
        image.setAttribute('x', String(-letter.width / 2));
        image.setAttribute('y', String(-letter.height / 2));
        image.setAttribute('width', String(letter.width));
        image.setAttribute('height', String(letter.height));
        // Pre-pose before the animator's first frame: in place, invisible.
        image.setAttribute('transform', `translate(${centerX} ${centerY})`);
        image.setAttribute('opacity', '0');
        wordmark.appendChild(image);

        const id = `letter${index}`;
        targets.set(id, image);
        letters.push({ id, centerX, centerY });
        cursorX += letter.width + LETTER_SPACING;
    });

    host.appendChild(svg);
    return { svg, targets, letters };
}
