import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    ViewEncapsulation,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
    untracked,
    viewChild,
} from '@angular/core';
import {
    cloudinaryHlsUrl,
    cloudinaryMp4Url,
    cloudinaryVideoPoster,
} from 'app/core/api/cloudinary-video';
import type Hls from 'hls.js';

/** What the player is currently doing, for the caller and for the template. */
export type VideoPlayerState = 'idle' | 'loading' | 'playing' | 'failed';

/** A baseline H.264/AAC MP4 — what every Cloudinary rendition is muxed as. */
const MSE_PROBE_TYPE = 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"';

/**
 * Whether Media Source Extensions can actually carry a stream here.
 *
 * This is the one capability `hls.js` cannot run without, so it is also the
 * honest test for "this browser genuinely needs native HLS" — as opposed to
 * merely claiming it (see {@link VideoPlayerComponent.usesNativeHls}).
 */
function mediaSourceUsable(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    const source = (
        window as Window & { MediaSource?: typeof MediaSource | undefined }
    ).MediaSource;
    return (
        !!source &&
        typeof source.isTypeSupported === 'function' &&
        source.isTypeSupported(MSE_PROBE_TYPE)
    );
}

/**
 * A Cloudinary-backed video player that streams rather than downloads.
 *
 * **The problem it solves.** A `<video src="…mp4">` pointed at a Cloudinary
 * master is a single progressive download: the browser pulls the whole file at
 * one fixed resolution, and if the `moov` atom sits after `mdat` it has to pull
 * most of it before the first frame paints. For the market scene that is ~32MB
 * spent before anything moves.
 *
 * **What it does instead.** It asks Cloudinary for an HLS manifest built by the
 * `sp_auto` streaming profile, and plays that. Cloudinary generates and serves
 * the renditions and segments — none of `.m3u8`, `.ts` or the ladder is ours to
 * produce, upload or keep in sync. The player pulls the manifest, then only the
 * segments it is about to show, at whichever rendition the connection can
 * actually carry.
 *
 * **How HLS gets played.** Where there is no MSE to stream through — iOS
 * Safari — the manifest goes straight on the element, which plays HLS natively,
 * and no library is loaded at all. Everywhere else `hls.js` is imported
 * *dynamically*, so it is a lazy chunk that never reaches a visitor whose
 * browser did not need it, and never runs during any server-side render.
 *
 * **When it loads.** Nothing is fetched at render: the element carries
 * `preload="none"` and shows a Cloudinary poster. The stream is attached only
 * once {@link start} is called — by a press of the play control, or by the
 * caller when the video is decorative and set to autoplay.
 *
 * Falls back to a Cloudinary-transformed MP4 (not the master) whenever HLS is
 * unavailable or fails outright.
 */
@Component({
    selector: 'ff-video-player',
    templateUrl: './video-player.component.html',
    styleUrl: './video-player.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'ff-video' },
})
export class VideoPlayerComponent {
    private readonly _destroyRef = inject(DestroyRef);

    /** Cloudinary `public_id` — the URLs are derived, never passed in whole. */
    readonly publicId = input.required<string>();

    /** Overrides the derived Cloudinary still, when a hand-picked one exists. */
    readonly poster = input<string | null>(null);

    /**
     * Starts as soon as the stream is attached, muted and looping — the
     * decorative case. The element still carries `preload="none"`, so nothing
     * is fetched until {@link start} runs.
     */
    readonly autoplay = input(false);
    readonly loop = input(false);
    readonly muted = input(true);
    readonly controls = input(false);

    /** Alt text equivalent; a decorative background should pass `''`. */
    readonly label = input('');

    readonly stateChange = output<VideoPlayerState>();
    /** Raised when neither HLS nor the MP4 fallback could play. */
    readonly failed = output<void>();

    private readonly _video =
        viewChild<ElementRef<HTMLVideoElement>>('videoEl');

    readonly state = signal<VideoPlayerState>('idle');

    readonly posterUrl = computed(
        () => this.poster() ?? cloudinaryVideoPoster(this.publicId())
    );

    /** Live `hls.js` instance, or `null` on native HLS / MP4 fallback. */
    private _hls: Hls | null = null;

    /** Guards against two `start()` calls racing a dynamic import. */
    private _attaching = false;

    /** Which `public_id` the current instance was built for. */
    private _attachedFor: string | null = null;

    /** True while {@link _teardown} runs, so its own `error` is not a failure. */
    private _tearingDown = false;

    /**
     * Set once the MP4 has been attached for the current video, so the ladder
     * cannot loop back onto its own last rung.
     */
    private _triedMp4 = false;

    constructor() {
        // Runs once the element exists (the view-child signal resolves after
        // view init), and again whenever the video changes. Swapping tears the
        // old stream down first: an `hls.js` left attached keeps its own timers
        // and buffer appends running against an element that has moved on.
        effect(() => {
            const video = this._video();
            const id = this.publicId();
            if (!video) {
                return;
            }
            untracked(() => {
                if (this._attachedFor && this._attachedFor !== id) {
                    this._teardown();
                    this.state.set('idle');
                }
                // An autoplaying video starts itself; everything else waits for
                // the play control, so nothing is fetched until asked for.
                if (this.autoplay() && this._attachedFor !== id) {
                    void this.start();
                }
            });
        });

        this._destroyRef.onDestroy(() => this._teardown());
    }

    /**
     * Attaches the stream and begins playback. Idempotent — a second press
     * while the first is still importing `hls.js` is ignored.
     */
    async start(): Promise<void> {
        const video = this._video()?.nativeElement;
        const id = this.publicId();
        if (!video || this._attaching || this._attachedFor === id) {
            return;
        }
        const hlsUrl = cloudinaryHlsUrl(id);
        if (!hlsUrl) {
            // Only reachable with an empty `public_id`; the cloud itself always
            // resolves (see `DEFAULT_CLOUD_NAME`).
            this._fail();
            return;
        }

        this._attaching = true;
        // A fresh attach starts at the top of the ladder again — this is only
        // reached for a video that is not the one already playing.
        this._triedMp4 = false;
        this._setState('loading');
        try {
            // Set imperatively as well as bound: autoplay is only permitted on
            // a muted element, and the flag has to be true *before* `play()`.
            video.muted = this.muted();
            if (this.usesNativeHls(video)) {
                // iOS Safari: the manifest goes straight on the element and
                // `hls.js` is never fetched.
                video.src = hlsUrl;
                this._attachedFor = id;
            } else {
                await this._attachHlsJs(video, hlsUrl, id);
            }
            await this._play(video);
        } catch {
            this._fallbackToMp4(video, id);
        } finally {
            this._attaching = false;
            // The video may have been swapped while this attach was in flight —
            // the dynamic `hls.js` import alone is long enough for that. Without
            // this the newer request was dropped by the guard above and the
            // player sat on the previous clip.
            if (this.publicId() !== id) {
                void this.start();
            }
        }
    }

    /** Called by the template's own play control, when one is shown. */
    onPlayRequested(): void {
        void this.start();
    }

    onPlaying(): void {
        this._setState('playing');
    }

    /**
     * The element's own error.
     *
     * The last word only on the MP4 path; before that it is one more reason to
     * step down the ladder. It used to end the player outright, which is how a
     * browser that merely *claimed* HLS took the whole hero down with it — the
     * manifest failed on the element and the MP4 that would have played was
     * never asked for.
     *
     * Ignored while tearing down, and while nothing is attached: an element
     * with no source reporting that it has no source is not a playback failure.
     */
    onElementError(): void {
        if (
            this._tearingDown ||
            !this._attachedFor ||
            this.state() === 'failed'
        ) {
            return;
        }
        const video = this._video()?.nativeElement;
        if (video && !this._triedMp4) {
            this._fallbackToMp4(video, this._attachedFor);
            return;
        }
        this._fail();
    }

    /**
     * Whether the manifest can go straight on the element.
     *
     * Two conditions, and the second one is the lesson. The browser has to
     * claim HLS **and** be unable to run `hls.js`. `canPlayType` alone decided
     * this until Chrome began answering `"maybe"` for
     * `application/vnd.apple.mpegurl` (151 does) while still refusing to load
     * the manifest: the element failed with `NotSupportedError — Failed to load
     * because no supported source was found`, `hls.js` was never imported, and
     * the hero dropped a player that MSE could have played perfectly well. So
     * the native path is now reserved for browsers with no MSE at all, which is
     * iOS Safari — the only place it was ever meant for.
     *
     * Public so the path can be asserted without attaching a stream: taking the
     * wrong branch is the failure this guards, and it costs a network fetch to
     * observe any other way.
     */
    usesNativeHls(video: HTMLVideoElement): boolean {
        return (
            video.canPlayType('application/vnd.apple.mpegurl') !== '' &&
            !mediaSourceUsable()
        );
    }

    private async _attachHlsJs(
        video: HTMLVideoElement,
        hlsUrl: string,
        id: string
    ): Promise<void> {
        // Dynamic, so the library is a lazy chunk: never parsed by a visitor on
        // Safari, and never touched at import time where there is no `window`.
        const { default: HlsCtor } = await import('hls.js');
        if (!HlsCtor.isSupported()) {
            throw new Error('HLS_UNSUPPORTED');
        }
        this._teardown();
        const hls: Hls = new HlsCtor({
            // Let Cloudinary's ladder and the measured bandwidth choose the
            // rendition; pinning a level here would defeat the point of ABR.
            startLevel: -1,
            // The manifest is all that is fetched up front; segments follow
            // only as playback needs them.
            maxBufferLength: 30,
        });
        this._hls = hls;
        this._attachedFor = id;

        hls.on(HlsCtor.Events.ERROR, (_event, data) => {
            if (!data.fatal) {
                return;
            }
            switch (data.type) {
                case HlsCtor.ErrorTypes.NETWORK_ERROR:
                    // A segment or the manifest failed; hls.js can re-request.
                    hls.startLoad();
                    break;
                case HlsCtor.ErrorTypes.MEDIA_ERROR:
                    // A decode/buffer stall, which a media reset usually clears.
                    hls.recoverMediaError();
                    break;
                default:
                    // Unrecoverable: drop the instance and try the MP4 rather
                    // than leaving a dead player on screen.
                    this._teardown();
                    this._fallbackToMp4(video, id);
            }
        });

        // Play once the ladder is known rather than straight after `attachMedia`:
        // at that point there is no media source yet, so an immediate `play()`
        // is a race that starts nothing on a slow manifest.
        hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
            void this._play(video);
        });

        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
    }

    /**
     * Last resort: a Cloudinary-transformed MP4. Still not the master upload —
     * `q_auto,f_auto` keeps even the fallback well under the original.
     */
    private _fallbackToMp4(video: HTMLVideoElement, id: string): void {
        const mp4 = cloudinaryMp4Url(id);
        if (!mp4) {
            this._fail();
            return;
        }
        this._triedMp4 = true;
        this._teardown();
        video.src = mp4;
        this._attachedFor = id;
        // If this one cannot play either, the element says so and
        // {@link onElementError} — which now knows the ladder is spent — fails.
        void this._play(video);
    }

    /**
     * Autoplay can be refused (an unmuted video, or a browser policy). That is
     * not a failure of the stream: the poster stays and the element is left
     * ready for a press.
     */
    private async _play(video: HTMLVideoElement): Promise<void> {
        try {
            await video.play();
        } catch {
            this._setState('idle');
        }
    }

    private _fail(): void {
        this._setState('failed');
        this.failed.emit();
    }

    private _setState(state: VideoPlayerState): void {
        this.state.set(state);
        this.stateChange.emit(state);
    }

    /**
     * Releases the stream: timers, buffers and the element's own source.
     *
     * `load()` on an element whose `src` has just been removed fires an `error`
     * — the element reporting that it has nothing to play, which is precisely
     * what we asked for. {@link _tearingDown} makes {@link onElementError}
     * ignore it. Without that guard, tearing down to attach `hls.js` raised a
     * failure through the caller and the hero dropped the player before it had
     * played a frame.
     */
    private _teardown(): void {
        const hadSource = this._hls !== null || this._attachedFor !== null;
        this._hls?.destroy();
        this._hls = null;
        this._attachedFor = null;
        const video = this._video()?.nativeElement;
        if (!video || !hadSource) {
            return;
        }
        this._tearingDown = true;
        video.removeAttribute('src');
        video.load();
        // Cleared after the event loop turn the `error` is delivered on.
        setTimeout(() => (this._tearingDown = false));
    }
}
