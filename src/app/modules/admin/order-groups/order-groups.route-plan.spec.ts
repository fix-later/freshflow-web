import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { RoutePlanResult } from '../logistics/logistics-admin.types';
import { OrderGroupsComponent } from './order-groups.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

const adminStub: Partial<AdminService> = {
    getOrderGroups: () =>
        Promise.resolve({ groups: [], totalCount: 0, page: 1, pageSize: 10 }),
    getMarkets: () => Promise.resolve([]),
    getHubs: () => Promise.resolve([]),
    getAgentOptions: () => Promise.resolve([]),
    getMarketSessions: () => Promise.resolve([]),
    getOrderGroupProgress: () => Promise.resolve({}),
};

const plan = (patch: Partial<RoutePlanResult>): RoutePlanResult =>
    ({
        planId: 'plan-1',
        status: 'proposed',
        hubId: 'hub-1',
        serviceDate: '2026-08-15',
        routes: [],
        unassigned: [],
        warnings: [],
        ...patch,
    }) as RoutePlanResult;

function build(): OrderGroupsComponent {
    TestBed.configureTestingModule({
        providers: [
            provideTransloco({
                config: { availableLangs: ['en'], defaultLang: 'en' },
                loader: StubTranslocoLoader,
            }),
            { provide: AdminService, useValue: adminStub },
            { provide: LogisticsAdminService, useValue: {} },
            { provide: Router, useValue: { navigate: () => undefined } },
            {
                provide: ActivatedRoute,
                useValue: { snapshot: { data: {}, queryParamMap: null } },
            },
        ],
    });
    return TestBed.createComponent(OrderGroupsComponent).componentInstance;
}

/**
 * `ApproveRoutePlanCommandHandler` refuses anything that is not a proposal, and
 * refuses a proposal that still has unassigned demand
 * (`PLAN_HAS_UNASSIGNED_ORDERS`). The screen used to offer the button anyway,
 * so the refusal arrived as a 409 in the backend's English.
 */
describe('Market session route plan approval', () => {
    it('offers approval only for a proposal with everything assigned', () => {
        const component = build();

        component.marketSessionRoutePlan.set(plan({}));
        expect(component.canApproveMarketSessionRoutePlan()).toBeTrue();
        expect(component.marketSessionRoutePlanBlocker()).toBeNull();
    });

    it('withholds approval while any demand is unassigned, and says why', () => {
        const component = build();

        component.marketSessionRoutePlan.set(
            plan({ unassigned: [{ restaurantId: 'r-1' }] })
        );

        expect(component.canApproveMarketSessionRoutePlan()).toBeFalse();
        expect(component.marketSessionRoutePlanBlocker()).toBe(
            'admin.orderGroups.marketSessions.routing.unassignedBlocks'
        );
    });

    it('treats a stale or superseded plan as spent rather than approvable', () => {
        const component = build();

        for (const status of ['stale', 'superseded']) {
            component.marketSessionRoutePlan.set(plan({ status }));
            expect(component.canApproveMarketSessionRoutePlan()).toBeFalse();
            expect(component.marketSessionRoutePlanBlocker()).toBe(
                'admin.orderGroups.marketSessions.routing.planSpent'
            );
        }
    });

    /** `planId` is null on an "empty" plan — there is nothing to approve. */
    it('says nothing about a day with no orders to route', () => {
        const component = build();

        component.marketSessionRoutePlan.set(
            plan({ planId: null, status: 'empty' })
        );

        expect(component.canApproveMarketSessionRoutePlan()).toBeFalse();
        expect(component.marketSessionRoutePlanBlocker()).toBeNull();
    });
});
