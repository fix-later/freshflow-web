import { ordersApi } from 'contract';
import { AdminService } from '../admin.service';
import { ScheduledOrdersAdminService } from './scheduled-orders-admin.service';

describe('ScheduledOrdersAdminService restaurant enrichment', () => {
    it('fetches restaurant users and replaces schedule IDs with display names', async () => {
        const listUsersByRole = jasmine.createSpy().and.resolveTo([
            {
                id: 'user-1',
                restaurantId: 'RESTAURANT-1',
                restaurantName: 'Bếp Xanh',
            },
        ]);
        const service = new ScheduledOrdersAdminService({
            listUsersByRole,
        } as unknown as AdminService);
        spyOn(ordersApi, 'apiV1OrdersScheduledGetRaw').and.resolveTo({
            raw: new Response(
                JSON.stringify({
                    data: {
                        data: [
                            {
                                scheduledOrderId: 'schedule-1',
                                restaurantId: 'restaurant-1',
                            },
                        ],
                        meta: { total: 1, page: 1, pageSize: 20 },
                    },
                })
            ),
        } as never);

        const result = await service.getScheduledOrders();
        const options = await service.getRestaurantOptions();

        expect(listUsersByRole).toHaveBeenCalledOnceWith('restaurant');
        expect(result.schedules[0].restaurantName).toBe('Bếp Xanh');
        expect(options).toEqual([{ id: 'restaurant-1', name: 'Bếp Xanh' }]);
    });
});
