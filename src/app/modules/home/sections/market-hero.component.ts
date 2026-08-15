import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    inject,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { activeLang } from 'app/core/i18n/active-lang';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { CatalogService } from 'app/modules/catalog/catalog.service';
import { CatalogCategory } from 'app/modules/catalog/catalog.types';
import { VideoPlayerComponent } from 'app/shared/video-player/video-player.component';

/** Category shortcuts beside the search. Five is the brief's aisle count. */
const QUICK_CATEGORIES = 5;

/**
 * Cloudinary `public_id` of the market-scene footage.
 *
 * An id, not a URL: `ff-video-player` derives the HLS manifest, the MP4
 * fallback and the poster from it, so the streaming profile and the delivery
 * transformations live in one place instead of being spelled out here. Empty
 * string means no footage is configured and the hero keeps the built scene.
 *
 * Replaces a `/media/market-scene.mp4` in `public/` that this repository never
 * shipped — the file 404'd and the hero fell back every time.
 */
export const MARKET_SCENE_PUBLIC_ID = 'market-scene_x7lbcm';

/**
 * Section 1: the hero, "Hôm nay đi chợ mua gì?".
 *
 * Asymmetric split. Left: where you are, what this is, and the two controls
 * that carry the most intent (search, aisle shortcuts). Right: a market scene —
 * the thing that says you have walked into a wholesale market rather than
 * opened a product list.
 *
 * **The scene has two layers, and both are real.**
 *
 * 1. A built market-gate composition (inline SVG, brand palette): awning,
 *    stall roofline, crates, a hand cart. Authored, not photographed — it is
 *    architecture and silhouette, so it never pretends to be a photo of a
 *    market that was not shot.
 * 2. Footage, streamed from Cloudinary ({@link MARKET_SCENE_PUBLIC_ID}), laid
 *    over the top.
 *
 * The built layer is the permanent backdrop rather than a swap-in fallback:
 * whenever the footage is absent, gated or unplayable it simply shows, and
 * otherwise it is covered. That means no empty box, no flash between poster and
 * first frame, and no state to get wrong.
 *
 * Three things keep the footage off the screen, and all three are deliberate:
 * `prefers-reduced-motion` (a looping market is decoration, and the still
 * composition says the same thing), an explicit `saveData` request, and a
 * playback failure that neither HLS nor the MP4 fallback could recover from.
 *
 * The previous hero put four featured listings here. They moved out rather than
 * being lost: `today-highlights` directly below already renders the same
 * `getFeaturedProducts` set from the same cache, so the board was showing the
 * page its own next section.
 */
@Component({
    selector: 'market-hero',
    templateUrl: './market-hero.component.html',
    styleUrls: ['./market-hero.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        FormsModule,
        MatIconModule,
        RouterLink,
        TranslocoModule,
        VideoPlayerComponent,
    ],
})
export class MarketHeroComponent {
    private _catalog = inject(CatalogService);
    private _markets = inject(MarketSelectionService);
    private _router = inject(Router);
    private _host = inject(ElementRef<HTMLElement>);
    private _destroyRef = inject(DestroyRef);

    private readonly _lang = activeLang();
    readonly isVi = computed(() => this._lang() === 'vi');

    readonly market = this._markets.selected;

    searchQuery = '';

    readonly sceneVideoId = MARKET_SCENE_PUBLIC_ID;

    /**
     * Set when the browser cannot play any source — the usual cause being that
     * no footage has been added yet. Drops the `<video>` from the DOM so it
     * stops retrying, leaving the built scene it was covering.
     */
    private readonly _videoFailed = signal(false);

    /**
     * Honours `prefers-reduced-motion` by not mounting the video at all, rather
     * than mounting it paused: a looping market scene is decoration, and for
     * someone who has asked for less motion the still composition says the same
     * thing. Read once — this is a viewing preference, not page state.
     */
    private readonly _prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /**
     * True when the visitor has explicitly asked to save data.
     *
     * This used to bar slow connections too (`effectiveType` of 3g and below),
     * and the reason was the footage: a 37MB progressive MP4 whose `moov` atom
     * sat after `mdat`, so the browser had to pull most of it before painting a
     * frame. That file is gone. The hero now streams adaptively from Cloudinary,
     * which answers a slow link by serving the 400kbps rung instead of the
     * 5.6Mbps one — the thing this gate existed to prevent is now the transport's
     * job, and it was suppressing the video for people who could have watched it.
     *
     * `saveData` stays: that is not a guess about the network, it is the visitor
     * saying they want less traffic, and set dressing is exactly what to drop.
     * `connection` is Chromium-only; where it is absent this is false.
     */
    private readonly _sparesData = (() => {
        if (typeof navigator === 'undefined') {
            return false;
        }
        const conn = (
            navigator as Navigator & { connection?: { saveData?: boolean } }
        ).connection;
        return conn?.saveData === true;
    })();

    readonly showVideo = computed(
        () =>
            !this._prefersReducedMotion &&
            !this._sparesData &&
            !this._videoFailed()
    );

    /** Root categories, as aisle shortcuts. */
    readonly quickCategories = computed<CatalogCategory[]>(() =>
        this._catalog.categoryTree().slice(0, QUICK_CATEGORIES)
    );

    constructor() {
        void this._markets.ensureLoaded();
        this._trackHeaderHeight();
    }

    /**
     * Publishes the storefront header's height as `--ff-hero-header`, so the
     * hero can size itself to exactly the rest of the first screen.
     *
     * Measured rather than hard-coded: the header is three stacked bands (top
     * strip, main bar, nav row) whose total changes with breakpoint, with the
     * strip's wrapping, and between the catalog and ordinary layouts. A
     * constant would be right at one width and wrong everywhere else, which is
     * the same mistake that put the hero's content column out of step with the
     * page.
     *
     * A `ResizeObserver` keeps it true through resize and font loading. If
     * there is no header to find — the hero rendered somewhere else, or in a
     * test — the CSS fallback stands in and nothing breaks.
     */
    private _trackHeaderHeight(): void {
        afterNextRender(() => {
            const header = document.querySelector('header');
            if (!header) {
                return;
            }
            const host = this._host.nativeElement;
            const apply = (): void =>
                host.style.setProperty(
                    '--ff-hero-header',
                    `${Math.round(header.getBoundingClientRect().height)}px`
                );

            apply();
            const observer = new ResizeObserver(apply);
            observer.observe(header);
            this._destroyRef.onDestroy(() => observer.disconnect());
        });
    }

    categoryLabel(category: CatalogCategory): string {
        return this.isVi() ? category.name : category.nameEn;
    }

    /**
     * Neither HLS nor the MP4 fallback could play. Drops the player from the
     * DOM so it stops retrying, leaving the built scene it was covering.
     *
     * The fade from built scene to footage now belongs to the player, which
     * holds the element back until a frame is actually painting.
     */
    onVideoUnavailable(): void {
        this._videoFailed.set(true);
    }

    /**
     * Submitting an empty box lands on the unfiltered catalog rather than
     * erroring. "Show me everything" is a reasonable thing to mean by it.
     */
    onSearch(): void {
        const term = this.searchQuery.trim();
        void this._router.navigate(['/catalog'], {
            queryParams: term ? { q: term } : {},
        });
    }
}
