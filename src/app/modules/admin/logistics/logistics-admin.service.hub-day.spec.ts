import { hubInboundApi } from 'contract';
import { LogisticsAdminService } from './logistics-admin.service';

/**
 * The hub-day reads (`procurement-plan`, `orders-by-restaurant`,
 * `sorting-progress`) each hang their rows off a different key and each take a
 * `DateOnly` the backend insists on. All three were parsed against a shape the
 * API does not send, so these pin the real contract.
 */
describe('LogisticsAdminService hub-day reads', () => {
    /** Resolves the generated `*Raw` call with `{ success, data }`. */
    function answer(method: string, data: unknown): jasmine.Spy {
        return spyOn(hubInboundApi, method as never).and.resolveTo({
            raw: new Response(JSON.stringify({ success: true, data })),
        } as never);
    }

    it('reads the procurement plan off `batches` and keys rows by batchId', async () => {
        const get = answer('apiV1HubsHubIdProcurementPlanGetRaw', {
            hubId: 'hub-1',
            date: '2026-08-15',
            batches: [{ batchId: 'batch-1', marketId: 'market-1', items: [] }],
        });

        const rows = await new LogisticsAdminService().getProcurementPlan(
            'hub-1',
            '2026-08-15'
        );

        expect(get).toHaveBeenCalledWith({
            hubId: 'hub-1',
            date: new Date('2026-08-15T00:00:00.000Z'),
        });
        expect(rows.length).toBe(1);
        expect(rows[0].id).toBe('batch-1');
    });

    it('reads orders-by-restaurant off `restaurants`, not the envelope guess', async () => {
        answer('apiV1HubsHubIdOrdersByRestaurantGetRaw', {
            hubId: 'hub-1',
            serviceDate: '2026-08-15',
            restaurants: [
                { restaurantId: 'rest-1', orderCount: 2, orders: [] },
                { restaurantId: 'rest-2', orderCount: 1, orders: [] },
            ],
        });

        const rows = await new LogisticsAdminService().getOrdersByRestaurant(
            'hub-1',
            '2026-08-15'
        );

        expect(rows.map((row) => row.id)).toEqual(['rest-1', 'rest-2']);
    });

    it('treats sorting progress as the list of order items it is', async () => {
        answer('apiV1HubsHubIdSortingProgressGetRaw', [
            { orderItemId: 'item-1', status: 'sorted', sortedQuantityKg: 12 },
            { orderItemId: 'item-2', status: 'pending', sortedQuantityKg: 0 },
        ]);

        const rows = await new LogisticsAdminService().getSortingProgress(
            'hub-1',
            '2026-08-15'
        );

        expect(rows.map((row) => row.id)).toEqual(['item-1', 'item-2']);
    });

    it('always sends a service date, since the backend rejects an empty one', async () => {
        const get = answer('apiV1HubsHubIdSortingProgressGetRaw', []);

        await new LogisticsAdminService().getSortingProgress('hub-1');

        const sent = get.calls.mostRecent().args[0] as { serviceDate: Date };
        expect(sent.serviceDate instanceof Date).toBeTrue();
        // The client serialises a `DateOnly` as the UTC day, so the instant has
        // to be UTC midnight of Vietnam's *current* day — a `Date` built from
        // local now would name yesterday before 07:00 in Hanoi.
        expect(sent.serviceDate.toISOString()).toMatch(/T00:00:00\.000Z$/);
        expect(sent.serviceDate.toISOString().substring(0, 10)).toBe(
            new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Ho_Chi_Minh',
            }).format(new Date())
        );
    });
});
