import { rawApi } from 'contract';
import { AdminService } from './admin.service';

describe('AdminService market sessions', () => {
    let service: AdminService;

    beforeEach(() => {
        service = new AdminService();
    });

    it('closes a session with the optional audit reason', async () => {
        const closed = {
            id: 'session-1',
            marketId: 'market-1',
            serviceDate: '2026-08-14',
            status: 'closed',
            closesAt: '2026-08-13T15:00:00Z',
            eligibleAgentCount: 1,
            availableVehicleCount: 1,
            hubVehicleCapacityKg: 1200,
            readiness: 'warning',
            warnings: [],
            createdAt: '2026-08-13T00:00:00Z',
            updatedAt: '2026-08-13T14:00:00Z',
        };
        const send = spyOn(rawApi, 'send').and.resolveTo(
            new Response(JSON.stringify({ data: closed }))
        );

        const result = await service.closeMarketSession(
            'session/with spaces',
            'Reached expected transport capacity'
        );

        expect(send).toHaveBeenCalledWith(
            '/api/v1/admin/market-sessions/session%2Fwith%20spaces/close',
            'POST',
            { reason: 'Reached expected transport capacity' }
        );
        expect(result.id).toBe('session-1');
        expect(result.status).toBe('closed');
    });

    it('requests the authoritative tracking page used by the close dialog', async () => {
        const tracking = {
            session: { id: 'session-1' },
            summary: {
                totalOrders: 3,
                activeOrders: 2,
                cancelledOrders: 1,
                totalLineItems: 4,
                totalQuantity: 10,
                merchandiseAmount: 100000,
                vatAmount: 8000,
                deliveryFee: 15000,
                grandTotal: 123000,
            },
            products: [],
            orders: [],
            ordersPagination: { total: 3, page: 1, pageSize: 1 },
            batch: null,
        };
        const send = spyOn(rawApi, 'send').and.resolveTo(
            new Response(JSON.stringify({ data: tracking }))
        );

        const result = await service.getMarketSessionTracking(
            'session-1',
            1,
            1
        );

        expect(send).toHaveBeenCalledWith(
            '/api/v1/admin/market-sessions/session-1/tracking',
            'GET',
            undefined,
            { page: '1', pageSize: '1' }
        );
        expect(result.summary.activeOrders).toBe(2);
        expect(result.summary.subtotalAmount).toBe(100000);
        expect(result.summary.totalAmount).toBe(123000);
        expect(result.ordersPagination.pageSize).toBe(1);
    });

    it('loads the resource choices and current assignments for a session', async () => {
        const resources = {
            sessionId: 'session-1',
            plannedCapacityKg: 750,
            referenceVehicleCapacityKg: 1200,
            selectedVehicleCapacityKg: 800,
            vehicles: [
                {
                    vehicleId: 'vehicle-1',
                    plateNumber: '51C-12345',
                    capacityKg: 800,
                    vehicleType: 'truck',
                    selected: true,
                },
            ],
            agents: [
                {
                    userId: 'agent-1',
                    email: 'agent@example.com',
                    fullName: 'Market Agent',
                    selected: true,
                },
            ],
        };
        const send = spyOn(rawApi, 'send').and.resolveTo(
            new Response(JSON.stringify({ data: resources }))
        );

        const result = await service.getMarketSessionResources('session/1');

        expect(send).toHaveBeenCalledWith(
            '/api/v1/admin/market-sessions/session%2F1/resource-options',
            'GET'
        );
        expect(result.vehicles[0].selected).toBeTrue();
        expect(result.agents[0].userId).toBe('agent-1');
    });

    it('saves the vehicles, agents and planned capacity assigned to a session', async () => {
        const payload = {
            plannedCapacityKg: 750,
            vehicleIds: ['vehicle-1'],
            agentUserIds: ['agent-1'],
        };
        const send = spyOn(rawApi, 'send').and.resolveTo(
            new Response(
                JSON.stringify({
                    data: {
                        sessionId: 'session-1',
                        ...payload,
                        referenceVehicleCapacityKg: 1200,
                        selectedVehicleCapacityKg: 800,
                        vehicles: [],
                        agents: [],
                    },
                })
            )
        );

        const result = await service.configureMarketSessionResources(
            'session-1',
            payload
        );

        expect(send).toHaveBeenCalledWith(
            '/api/v1/admin/market-sessions/session-1/resources',
            'PUT',
            payload
        );
        expect(result.plannedCapacityKg).toBe(750);
    });

    it('derives legacy session money from order lines when summary fields are absent', async () => {
        const tracking = {
            session: { id: 'session-1' },
            summary: {
                totalOrders: 1,
                activeOrders: 1,
                cancelledOrders: 0,
                totalLineItems: 1,
                totalQuantity: 2,
                deliveryFee: 15000,
            },
            products: [],
            orders: [
                {
                    orderId: 'order-1',
                    restaurantId: 'restaurant-1',
                    restaurantName: 'Haidilao',
                    status: 'batched',
                    totalAmount: 115000,
                    deliveryFee: 15000,
                    items: [
                        {
                            marketProductId: 'product-1',
                            productName: 'Cam Mỹ',
                            quantity: 2,
                            unitPrice: 50000,
                            subtotal: 100000,
                        },
                    ],
                },
            ],
            ordersPagination: { total: 1, page: 1, pageSize: 20 },
            batch: null,
        };
        spyOn(rawApi, 'send').and.resolveTo(
            new Response(JSON.stringify({ data: tracking }))
        );

        const result = await service.getMarketSessionTracking('session-1');

        expect(result.summary.subtotalAmount).toBe(100000);
        expect(result.summary.deliveryFee).toBe(15000);
        expect(result.summary.totalAmount).toBe(115000);
        expect(result.orders[0].subtotalAmount).toBe(100000);
    });
});
