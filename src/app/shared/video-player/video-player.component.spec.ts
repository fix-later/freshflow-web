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

/**
 * The element is driven through a real `<video>`, so both are stubbed: HLS is
 * reported as natively playable (keeping `hls.js` out of the test entirely) and
 * `play()` resolves instead of being refused by the autoplay policy, which no
 * headless browser applies the same way.
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

    /** A genuine error, once a source is attached, still fails. */
    it('reports a failure when the attached source cannot play', async () => {
        const { player, video } = build();
        await Promise.resolve();

        video.dispatchEvent(new Event('error'));

        expect(player.state()).toBe('failed');
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
