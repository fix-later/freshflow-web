import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import { AdminMarketSessionTracking, AdminOrderGroupRow } from '../admin.types';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { RoutePlanResult } from '../logistics/logistics-admin.types';
import {
    OrderGroupsComponent,
    activeMarketSessionRouteRows,
    procurementItemAssignments,
} from './order-groups.component';

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

    it('hides planning controls after the current plan is approved', () => {
        const component = build();
        component.marketSessionRoutePlan.set(plan({ status: 'approved' }));

        expect(component.showMarketSessionRoutePlanningControls()).toBeFalse();
    });

    it('recognizes persisted reviewed routes after reopening the dialog', () => {
        const component = build();
        component.marketSessionRoutes.set([
            {
                route: { id: 'route-1', status: 'reviewed' },
                deliveries: [],
                manifest: null,
            },
        ]);

        expect(component.showMarketSessionRoutePlanningControls()).toBeFalse();
    });
});

describe('Market session active routes', () => {
    it('removes cancelled route proposals from the operational list', () => {
        const reviewed = { id: 'route-active', status: 'reviewed' };

        expect(
            activeMarketSessionRouteRows([
                { id: 'route-cancelled', status: 'cancelled' },
                reviewed,
            ])
        ).toEqual([reviewed]);
    });

    it('does not offer dispatch again after a route is assigned', () => {
        const component = build();

        expect(
            component.canAssignRoute({ id: 'route-1', status: 'reviewed' })
        ).toBeTrue();
        expect(
            component.canAssignRoute({ id: 'route-1', status: 'assigned' })
        ).toBeFalse();
    });

    it('shows restaurant orders before delivery snapshots are created', () => {
        const component = build();
        component.marketSessionTracking.set({
            orders: [
                {
                    orderId: 'order-1',
                    restaurantId: 'restaurant-1',
                    restaurantName: 'Haidilao',
                    status: 'batched',
                    subtotalAmount: 0,
                    vatAmount: 0,
                    deliveryFee: 0,
                    totalAmount: 0,
                    items: [],
                },
            ],
        } as unknown as AdminMarketSessionTracking);
        component.marketSessionRoutePlan.set(
            plan({
                routes: [
                    {
                        id: 'route-1',
                        stops: [
                            {
                                restaurantName: 'Haidilao',
                                orderIds: ['order-1'],
                            },
                        ],
                    },
                ],
            })
        );

        const rows = component.marketSessionRouteOrderStatuses({
            route: { id: 'route-1', status: 'planned', stops: [] },
            deliveries: [],
            manifest: null,
        });

        expect(rows).toEqual([
            jasmine.objectContaining({
                orderId: 'order-1',
                restaurantName: 'Haidilao',
                orderStatus: 'batched',
                delivery: null,
            }),
        ]);
    });
});

describe('Dispatch driver labels', () => {
    it('shows the driver name when the eligible-driver response includes one', () => {
        const component = build();

        expect(
            component.driverLabel({
                id: 'a6cad264-0000-0000-0000-000000000000',
                fullName: 'Nguyen Van Tai',
                email: 'driver@test.freshflow',
            })
        ).toBe('Nguyen Van Tai');
    });

    it('falls back to email when the driver has no name', () => {
        const component = build();

        expect(
            component.driverLabel({
                id: 'a6cad264-0000-0000-0000-000000000000',
                fullName: null,
                email: 'driver@test.freshflow',
            })
        ).toBe('driver@test.freshflow');
    });
});

describe('Market-session procurement assignments', () => {
    it('builds one assignment per unpurchased product', () => {
        expect(
            procurementItemAssignments(
                [
                    { marketProductId: 'product-a' },
                    {
                        marketProductId: 'product-b',
                        purchasedAt: '2026-08-15T08:00:00Z',
                    },
                    { marketProductId: 'product-c' },
                ],
                {
                    'product-a': 'agent-a',
                    'product-b': 'agent-b',
                }
            )
        ).toEqual([
            { marketProductId: 'product-a', agentUserId: 'agent-a' },
            {
                marketProductId: 'product-c',
                agentUserId: '00000000-0000-0000-0000-000000000000',
            },
        ]);
    });

    it('assigns and unassigns a ticked product for the selected agent', () => {
        const component = build();
        component.selectedMarketSessionAgentId.set('agent-a');
        component.marketSessionItemAssignments.set({
            'product-a': 'agent-b',
            'product-b': 'agent-b',
        });

        component.setMarketSessionItemForSelectedAgent('product-a', true);
        expect(component.marketSessionItemAssignments()).toEqual({
            'product-a': 'agent-a',
            'product-b': 'agent-b',
        });

        component.setMarketSessionItemForSelectedAgent('product-a', false);
        expect(component.marketSessionItemAssignments()).toEqual({
            'product-a': '',
            'product-b': 'agent-b',
        });
    });

    it('ticks all available products without changing purchased products', () => {
        const component = build();
        component.selectedMarketSessionAgentId.set('agent-a');
        component.marketSessionAssignmentBatch.set({
            status: 'Manifested',
            items: [
                { marketProductId: 'product-a' },
                { marketProductId: 'product-b' },
                {
                    marketProductId: 'product-c',
                    purchasedAt: '2026-08-15T08:00:00Z',
                },
            ],
        } as AdminOrderGroupRow);
        component.marketSessionItemAssignments.set({
            'product-a': 'agent-b',
            'product-b': '',
            'product-c': 'agent-c',
        });

        component.setAllMarketSessionItemsForSelectedAgent(true);
        expect(component.marketSessionItemAssignments()).toEqual({
            'product-a': 'agent-a',
            'product-b': 'agent-a',
            'product-c': 'agent-c',
        });

        component.setAllMarketSessionItemsForSelectedAgent(false);
        expect(component.marketSessionItemAssignments()).toEqual({
            'product-a': '',
            'product-b': '',
            'product-c': 'agent-c',
        });
    });

    it('enables saving only while assignments differ from the saved state', () => {
        const component = build();
        component.marketSessionAssignmentBatch.set({
            status: 'Manifested',
            items: [
                { marketProductId: 'product-a' },
                { marketProductId: 'product-b' },
            ],
        } as AdminOrderGroupRow);
        component.marketSessionItemAssignments.set({
            'product-a': 'agent-a',
            'product-b': 'agent-b',
        });
        component.savedMarketSessionItemAssignments.set({
            'product-a': 'agent-a',
            'product-b': 'agent-b',
        });

        expect(component.marketSessionAssignmentsDirty()).toBeFalse();

        component.marketSessionItemAssignments.update((assignments) => ({
            ...assignments,
            'product-b': 'agent-a',
        }));
        expect(component.marketSessionAssignmentsDirty()).toBeTrue();

        component.savedMarketSessionItemAssignments.set({
            ...component.marketSessionItemAssignments(),
        });
        expect(component.marketSessionAssignmentsDirty()).toBeFalse();
    });
});

describe('Market-session planning window', () => {
    it('starts on today and keeps the configured seven future days visible', () => {
        const component = build();
        const days = component.planningDays();

        expect(days.length).toBe(8);
        expect(component.selectedPlanningIso()).toBe(days[0].iso);
        expect(component.planningDayLabel(days[0])).toBe(
            'admin.orderGroups.planning.today'
        );
        expect(component.planningDayLabel(days[1])).toBe(
            'admin.orderGroups.planning.tomorrow'
        );
    });
});
