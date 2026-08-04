import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProfileComponent } from './profile.component';

/**
 * Regression: entering `/profile` from another page threw out of the
 * constructor, which cancelled the navigation and left the user on the page
 * they clicked from — "Hồ sơ" in the header account menu appeared to do
 * nothing.
 *
 * The cause was reading `route.firstChild.snapshot.url[0]`: on an in-app
 * navigation the child route is activated *after* the parent component is
 * created, so `snapshot` is still undefined at that point. A cold load builds
 * the whole route tree first, which is why a direct visit worked and only the
 * in-app click failed.
 *
 * The component is constructed rather than rendered — mounting it would pull
 * in the account shell and a router outlet for no added coverage, and the
 * failure was in the constructor.
 */
describe('ProfileComponent', () => {
    function construct(firstChild: unknown): () => ProfileComponent {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: {
                        firstChild,
                        queryParamMap: of(new Map()),
                        snapshot: { queryParamMap: new Map() },
                    },
                },
            ],
        });
        return () =>
            TestBed.runInInjectionContext(() => new ProfileComponent());
    }

    it('constructs when the child route is not activated yet', () => {
        expect(construct({})).not.toThrow();
    });

    it('constructs when there is no child route at all', () => {
        expect(construct(null)).not.toThrow();
    });
});
