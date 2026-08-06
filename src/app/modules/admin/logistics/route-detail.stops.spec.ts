import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { LogisticsAdminService } from './logistics-admin.service';
import { RouteStop } from './logistics-admin.types';
import { RouteDetailComponent } from './route-detail.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

const stop = (entityType: string, id: string, order: number): RouteStop => ({
    stopOrder: order,
    entityType,
    entityId: id,
    entityName: id,
});

/** Hub first, then three restaurants — the shape `calculate` produces. */
const stops = (): RouteStop[] => [
    stop('hub', 'hub-1', 0),
    stop('restaurant', 'r1', 1),
    stop('restaurant', 'r2', 2),
    stop('restaurant', 'r3', 3),
];

function build(): RouteDetailComponent {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [
            provideTransloco({
                config: { availableLangs: ['vi'], defaultLang: 'vi' },
                loader: StubTranslocoLoader,
            }),
            { provide: Router, useValue: { navigate: () => undefined } },
            {
                provide: ActivatedRoute,
                useValue: { snapshot: { paramMap: { get: () => '' } } },
            },
            { provide: LogisticsAdminService, useValue: {} },
            RouteDetailComponent,
        ],
    });
    const component = TestBed.inject(RouteDetailComponent);
    component.stops.set(stops());
    return component;
}

/**
 * `DeliveryRoute.BuildReorderedStops` throws "Pickup stops must precede
 * restaurant (dropoff) stops", answered as `INVALID_STOP_ORDER` (422). The
 * arrows must not offer an order the review would be refused for.
 */
describe('Route detail — stop reordering follows the domain rule', () => {
    it('never lets the hub move, and never lets a dropoff climb above it', () => {
        const component = build();

        // The hub is the leading pickup: both arrows are closed for it.
        expect(component.canMoveUp(0)).toBeFalse();
        expect(component.canMoveDown(0)).toBeFalse();

        // The first restaurant sits directly under the hub — it cannot climb.
        expect(component.canMoveUp(1)).toBeFalse();
        expect(component.canMoveDown(1)).toBeTrue();
    });

    it('reorders freely among the dropoffs', () => {
        const component = build();

        expect(component.canMoveUp(2)).toBeTrue();
        expect(component.canMoveDown(2)).toBeTrue();
        // Last stop has nowhere below it.
        expect(component.canMoveDown(3)).toBeFalse();
        expect(component.canMoveUp(3)).toBeTrue();

        component.moveStop(2, -1);
        expect(component.stops().map((s) => s.entityId)).toEqual([
            'hub-1',
            'r2',
            'r1',
            'r3',
        ]);
        expect(component.reordered()).toBeTrue();
    });

    it('ignores a move the rule forbids instead of performing it', () => {
        const component = build();

        component.moveStop(1, -1); // restaurant over the hub
        component.moveStop(0, 1); // hub under a restaurant

        expect(component.stops().map((s) => s.entityId)).toEqual([
            'hub-1',
            'r1',
            'r2',
            'r3',
        ]);
        expect(component.reordered()).toBeFalse();
    });
});
