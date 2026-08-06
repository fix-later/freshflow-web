import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { LogisticsAdminService } from './logistics-admin.service';
import { HubOption } from './logistics-admin.types';
import { RouteCreateComponent } from './route-create.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

const hub = (id: string, hasCoordinates: boolean): HubOption => ({
    value: id,
    label: id,
    hasCoordinates,
});

function build(hubs: HubOption[]): RouteCreateComponent {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [
            provideTransloco({
                config: { availableLangs: ['vi'], defaultLang: 'vi' },
                loader: StubTranslocoLoader,
            }),
            { provide: Router, useValue: { navigate: () => undefined } },
            {
                provide: LogisticsAdminService,
                useValue: {
                    hubOptions: () => Promise.resolve(hubs),
                    routeSuggestions: () =>
                        Promise.resolve({
                            serviceDate: '',
                            markets: [],
                            restaurants: [],
                        }),
                    listRestaurantOptions: () => Promise.resolve([]),
                },
            },
            RouteCreateComponent,
        ],
    });
    const component = TestBed.inject(RouteCreateComponent);
    component.hubs.set(hubs);
    component.hubsLoaded.set(true);
    return component;
}

/**
 * `/routes/suggestions` answers `{ serviceDate, hubs, restaurants }`. The hubs
 * are the ones with goods waiting that date — the origin the day calls for.
 * They were read from a `markets` key the response has never carried, so the
 * whole half was dropped and the origin came from the plain hub list instead.
 */
describe('Route create — the day suggests the hub, not the hub list', () => {
    it('ranks hubs with waiting orders first and selects one of them', async () => {
        const component = build([hub('quiet', true), hub('busy', true)]);
        component.suggestedHubs.set([
            { id: 'busy', name: 'busy', orderCount: 7 },
        ]);

        // Same call the suggestion load makes once both sources have landed.
        component['_applyHubSuggestions']();

        expect(component.hubs().map((h) => h.value)).toEqual(['busy', 'quiet']);
        expect(component.hubs()[0].orderCount).toBe(7);
        expect(component.hubId.value).toBe('busy');
    });

    it('keeps a hub with nothing waiting selectable, and selected when nothing has work', () => {
        const component = build([hub('quiet', true)]);
        component.suggestedHubs.set([]);

        component['_applyHubSuggestions']();

        // Routing from a quiet hub stays Admin's call — the list is ranked,
        // never filtered.
        expect(component.hubs().map((h) => h.value)).toEqual(['quiet']);
        expect(component.hubId.value).toBe('quiet');
    });
});

describe('Route create — the rules the calculate call enforces', () => {
    /**
     * `CalculateRouteCommandHandler` counts the hub as a stop:
     * `DestinationRestaurantIds.Count + 1 > 20`. Picking 20 restaurants used to
     * pass this gate and come back 422.
     */
    it('allows 19 destinations and refuses the 20th', () => {
        const component = build([hub('h1', true)]);
        component.selectedHubId.set('h1');

        const pick = (n: number): void =>
            component.selectedRestaurants.set(
                new Set(Array.from({ length: n }, (_, i) => `r${i}`))
            );

        pick(19);
        expect(component.tooManyStops()).toBeFalse();
        expect(component.canCalculate()).toBeTrue();

        pick(20);
        expect(component.tooManyStops()).toBeTrue();
        expect(component.canCalculate()).toBeFalse();
    });

    /**
     * A hub with no coordinates is the route's first stop and is refused with
     * `MISSING_COORDINATES` before anything else is read — so the screen says
     * so instead of spending the request.
     */
    it('blocks both actions on a hub with no coordinates, and says why', () => {
        const component = build([hub('h1', false)]);
        component.selectedHubId.set('h1');
        component.selectedRestaurants.set(new Set(['r1']));

        expect(component.canCalculate()).toBeFalse();
        expect(component.canPlan()).toBeFalse();
        expect(component.blockedReason()).toBe(
            'admin.routes.create.blocked.hubNoCoordinates'
        );
    });

    it('lets a hub with coordinates through', () => {
        const component = build([hub('h1', true)]);
        component.selectedHubId.set('h1');
        component.selectedRestaurants.set(new Set(['r1']));

        expect(component.blockedReason()).toBeNull();
        expect(component.canCalculate()).toBeTrue();
        expect(component.canPlan()).toBeTrue();
    });
});
