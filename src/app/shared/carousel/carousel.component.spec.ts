import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { CarouselComponent } from './carousel.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

@Component({
    standalone: true,
    imports: [CarouselComponent],
    template: `
        <ff-carousel [items]="items()" [perView]="1" [interval]="0">
            <ng-template let-item>
                <span class="slide">{{ item }}</span>
            </ng-template>
        </ff-carousel>
    `,
})
class HostComponent {
    readonly items = signal(['a', 'b', 'c']);
}

function build(): {
    host: HostComponent;
    carousel: CarouselComponent<string>;
    detect: () => void;
} {
    TestBed.configureTestingModule({
        imports: [HostComponent],
        providers: [
            provideTransloco({
                config: { availableLangs: ['en'], defaultLang: 'en' },
                loader: StubTranslocoLoader,
            }),
        ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const carousel = fixture.debugElement.children[0]
        .componentInstance as CarouselComponent<string>;
    return {
        host: fixture.componentInstance,
        carousel,
        detect: () => fixture.detectChanges(),
    };
}

/**
 * The loop is seamless because the head of the list is cloned onto the tail:
 * advancing past the last slide lands on a copy of the first, which is then
 * swapped for the real one with the transition off. These pin that mechanism —
 * without the clone the row would visibly rewind.
 */
describe('CarouselComponent', () => {
    it('renders a cloned head so the row can run past its last slide', () => {
        const { carousel } = build();

        // Three real slides, plus one clone for a single-slide view.
        expect(carousel.slides().length).toBe(4);
        expect(carousel.slides()[3]).toBe(carousel.items()[0]);
    });

    it('does not clone, or offer to loop, a single slide', () => {
        const { host, carousel, detect } = build();

        host.items.set(['only']);
        detect();

        expect(carousel.slides().length).toBe(1);
        expect(carousel.canLoop()).toBeFalse();
    });

    it('advances onto the clone, and keeps the first dot lit there', () => {
        const { carousel } = build();

        carousel.next();
        carousel.next();
        expect(carousel.index()).toBe(2);
        expect(carousel.activeDot()).toBe(2);

        // Onto the cloned first slide: the index runs past the real list, and
        // the dot reads it as the original it copies.
        carousel.next();
        expect(carousel.index()).toBe(3);
        expect(carousel.activeDot()).toBe(0);
    });

    it('snaps back to the real first slide without animating', async () => {
        const { carousel } = build();
        carousel.index.set(2);

        carousel.next();
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(carousel.index()).toBe(0);
        // The correction must not be animated, or the row rewinds on screen.
        expect(carousel.animating()).toBeFalse();
    });

    it('offsets the track by one slide width per step', () => {
        const { carousel } = build();

        carousel.goTo(2);

        // `perView` of 1, so each step is a full 100%.
        expect(carousel.offset()).toBe(200);
    });

    it('pauses while a pointer or focus is inside', () => {
        const { carousel } = build();

        carousel.pause(true);
        expect(carousel.paused()).toBeTrue();
        carousel.pause(false);
        expect(carousel.paused()).toBeFalse();
    });

    it('returns to the first slide when the list changes underneath it', () => {
        const { host, carousel, detect } = build();
        carousel.goTo(2);

        host.items.set(['x', 'y']);
        detect();

        expect(carousel.index()).toBe(0);
    });
});
