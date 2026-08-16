import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { VideoPlayerComponent } from './video-player.component';

@Component({
    standalone: true,
    imports: [VideoPlayerComponent],
    template: `
        <ff-video-player
            [publicId]="id()"
            [autoplay]="autoplay()"
            [muted]="true"
        ></ff-video-player>
    `,
})
class HostComponent {
    readonly id = signal('market-scene_x7lbcm');
    readonly autoplay = signal(true);
}

type MaybeMediaSource = Window & { MediaSource?: typeof MediaSource };

let savedMediaSource: typeof MediaSource | undefined;
let mediaSourceHidden = false;

/** Puts `window.MediaSource` back, whatever a test did to it. */
function setMediaSource(value: typeof MediaSource | undefined): void {
    Object.defineProperty(window, 'MediaSource', {
        value,
        configurable: true,
        writable: true,
    });
}

/**
 * Hides Media Source Extensions, which is what makes the player take the
 * native-HLS path — the iOS Safari case. Every test that wants that path has to
 * say so now: claiming HLS is no longer enough on its own, precisely because
 * Chrome claims it too.
 */
function hideMediaSource(): void {
    if (mediaSourceHidden) {
        return;
    }
    savedMediaSource = (window as MaybeMediaSource).MediaSource;
    mediaSourceHidden = true;
    setMediaSource(undefined);
}

/**
 * The element is driven through a real `<video>`, so all of it is stubbed: HLS
 * is reported as natively playable and MSE is hidden (which together keep
 * `hls.js` out of the test entirely), and `play()` resolves instead of being
 * refused by the autoplay policy, which no headless browser applies the same
 * way.
 */
function build(): {
    host: HostComponent;
    video: HTMLVideoElement;
    player: VideoPlayerComponent;
    detect: () => void;
} {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);

    const proto = HTMLMediaElement.prototype;
    spyOn(proto, 'canPlayType').and.returnValue('maybe');
    spyOn(proto, 'play').and.resolveTo();
    spyOn(proto, 'load').and.stub();
    hideMediaSource();

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
        host: fixture.componentInstance,
        video: el.querySelector('video') as HTMLVideoElement,
        player: fixture.debugElement.children[0]
            .componentInstance as VideoPlayerComponent,
        detect: () => fixture.detectChanges(),
    };
}

describe('VideoPlayerComponent', () => {
    afterEach(() => {
        if (mediaSourceHidden) {
            setMediaSource(savedMediaSource);
            mediaSourceHidden = false;
        }
    });

    it('attaches the HLS manifest by itself when autoplay is set', async () => {
        const { video } = build();
        await Promise.resolve();

        // The whole point: nothing had to be pressed.
        expect(video.src).toContain('/video/upload/sp_auto/');
        expect(video.src.endsWith('.m3u8')).toBeTrue();
    });

    it('renders a Cloudinary poster and fetches nothing before it starts', () => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        const fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.autoplay.set(false);
        fixture.detectChanges();
        const video = fixture.nativeElement.querySelector(
            'video'
        ) as HTMLVideoElement;

        expect(video.getAttribute('preload')).toBe('none');
        expect(video.getAttribute('poster')).toContain('so_auto');
        // No source until asked for — this is what keeps the 32MB off the page.
        expect(video.getAttribute('src')).toBeNull();
    });

    /**
     * `load()` on a source-less element fires `error` — the element saying it
     * has nothing to play, which is exactly what teardown asked for. Treating
     * that as a playback failure made the player tear itself down while
     * attaching `hls.js`, and the hero dropped it before a frame ever painted.
     */
    it('does not report a failure while nothing is attached', () => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        const fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.autoplay.set(false);
        fixture.detectChanges();
        const player = fixture.debugElement.children[0]
            .componentInstance as VideoPlayerComponent;
        let failed = false;
        player.failed.subscribe(() => (failed = true));

        (
            fixture.nativeElement.querySelector('video') as HTMLVideoElement
        ).dispatchEvent(new Event('error'));

        expect(failed).toBeFalse();
        expect(player.state()).not.toBe('failed');
    });

    /**
     * A source that will not play steps down the ladder rather than ending the
     * player: the MP4 is still untried while the failure came from HLS.
     */
    it('falls back to the MP4 when the attached stream errors', async () => {
        const { player, video } = build();
        await Promise.resolve();
        let failed = false;
        player.failed.subscribe(() => (failed = true));

        video.dispatchEvent(new Event('error'));

        expect(video.src).toContain('/video/upload/q_auto,f_auto/');
        expect(video.src.endsWith('.mp4')).toBeTrue();
        expect(failed).toBeFalse();
    });

    /** Only when the last rung fails too is there nothing left to show. */
    it('reports a failure once the MP4 has failed as well', async () => {
        const { player, video } = build();
        await Promise.resolve();

        video.dispatchEvent(new Event('error'));
        // Teardown ignores the `error` its own `load()` raises, and clears that
        // guard a turn later — so the MP4's own failure comes after it.
        await new Promise((resolve) => setTimeout(resolve));
        video.dispatchEvent(new Event('error'));

        expect(player.state()).toBe('failed');
    });

    /**
     * The regression that took the hero's footage off the page. Chrome 151
     * answers `"maybe"` to `canPlayType('application/vnd.apple.mpegurl')` and
     * then cannot load the manifest at all, so trusting that answer put a
     * `.m3u8` straight on the element and the whole player was dropped —
     * on a browser whose MSE would have streamed it without complaint.
     */
    it('does not take the native path on a browser that has MSE', () => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        const fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.autoplay.set(false);
        spyOn(HTMLMediaElement.prototype, 'canPlayType').and.returnValue(
            'maybe'
        );
        fixture.detectChanges();
        const player = fixture.debugElement.children[0]
            .componentInstance as VideoPlayerComponent;
        const video = fixture.nativeElement.querySelector(
            'video'
        ) as HTMLVideoElement;

        expect(player.usesNativeHls(video)).toBeFalse();
    });

    it('re-points at the new video when the id changes', async () => {
        const { host, video, detect } = build();
        // Long enough for the first attach to settle: `start()` awaits `play()`,
        // so its `finally` lands a couple of microtasks in.
        await new Promise((resolve) => setTimeout(resolve));

        host.id.set('another-clip');
        detect();
        await new Promise((resolve) => setTimeout(resolve));

        expect(video.src).toContain('another-clip.m3u8');
    });
});
