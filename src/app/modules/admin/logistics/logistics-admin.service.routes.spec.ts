import { rawApi } from 'contract';
import { LogisticsAdminService } from './logistics-admin.service';

describe('LogisticsAdminService market-session route planning', () => {
    it('sends the current backend contract and normalizes planned route ids', async () => {
        const send = spyOn(rawApi, 'send').and.resolveTo(
            new Response(
                JSON.stringify({
                    data: {
                        planId: 'plan-1',
                        status: 'proposed',
                        hubId: 'hub-1',
                        serviceDate: '2026-08-15',
                        routes: [{ routeId: 'route-1', stops: [] }],
                        unassigned: [],
                        warnings: [],
                    },
                })
            )
        );

        const plan = await new LogisticsAdminService().planRoutes({
            marketSessionId: 'session-1',
            optimizationCriteria: 'distance',
        });

        expect(send).toHaveBeenCalledWith(
            '/api/v1/logistics/routes/plan',
            'POST',
            {
                marketSessionId: 'session-1',
                optimizationCriteria: 'DISTANCE',
            }
        );
        expect(plan.planId).toBe('plan-1');
        expect(plan.routes[0].id).toBe('route-1');
    });

    it('keeps an empty backend plan empty', async () => {
        spyOn(rawApi, 'send').and.resolveTo(
            new Response(
                JSON.stringify({
                    data: {
                        planId: null,
                        status: 'empty',
                        hubId: 'hub-1',
                        serviceDate: '2026-08-15',
                        routes: [],
                        unassigned: [],
                        warnings: [],
                    },
                })
            )
        );

        const plan = await new LogisticsAdminService().planRoutes({
            marketSessionId: 'session-1',
            optimizationCriteria: 'cost',
        });

        expect(plan.status).toBe('empty');
        expect(plan.routes).toEqual([]);
    });

    it('loads every delivery status detail exposed to Admin for a route', async () => {
        const send = spyOn(rawApi, 'send');
        spyOn(
            // The generated client owns this endpoint; reach the shared
            // instance through the service module's imported singleton.
            await import('contract').then((contract) => contract.routesApi),
            'apiV1LogisticsRoutesRouteIdDeliveriesGetRaw'
        ).and.resolveTo({
            raw: new Response(
                JSON.stringify({
                    data: [
                        {
                            deliveryId: 'delivery-1',
                            orderId: 'order-1',
                            sequenceNumber: 2,
                            status: 'arrived',
                            estimatedArrival: '2026-08-15T01:00:00Z',
                            actualArrival: '2026-08-15T01:03:00Z',
                            proofUrl: 'https://example.test/proof.jpg',
                        },
                    ],
                })
            ),
        } as never);

        const deliveries = await new LogisticsAdminService().getRouteDeliveries(
            'route-1'
        );

        expect(send).not.toHaveBeenCalled();
        expect(deliveries[0]).toEqual(
            jasmine.objectContaining({
                deliveryId: 'delivery-1',
                orderId: 'order-1',
                sequenceNumber: 2,
                status: 'arrived',
                proofUrl: 'https://example.test/proof.jpg',
            })
        );
    });
});
