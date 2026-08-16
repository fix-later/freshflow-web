import { rawApi } from 'contract';
import { AdminService } from './admin.service';

/**
 * `GET /admin/order-groups/{batchId}` — the batch detail endpoint BE added in
 * "Add admin procurement batch detail endpoint". Before it existed the console
 * had to page the whole list to find one batch, so the two things worth
 * pinning are that the single call is made, and that the list scan is still
 * there for a backend that answers 404.
 */
describe('AdminService order group detail', () => {
    let service: AdminService;

    beforeEach(() => {
        service = new AdminService();
    });

    it('reads one batch from the detail endpoint and normalises the row', async () => {
        const send = spyOn(rawApi, 'send').and.resolveTo(
            new Response(
                JSON.stringify({
                    data: {
                        id: 'batch-1',
                        code: 'CHO-1708',
                        batchDate: '2026-08-17',
                        marketId: 'market-1',
                        members: [{ orderId: 'order-1' }, { orderId: 'o-2' }],
                        items: [],
                        exceptions: [{ id: 'exception-1' }],
                    },
                })
            )
        );

        const batch = await service.getOrderGroup('batch/1');

        expect(send).toHaveBeenCalledWith(
            '/api/v1/admin/order-groups/batch%2F1',
            'GET'
        );
        expect(batch?.id).toBe('batch-1');
        expect(batch?.batchNumber).toBe('CHO-1708');
        // Normalised the same way list rows are, so the detail page binds the
        // same fields whichever read produced the row.
        expect(batch?.orderCount).toBe(2);
        expect(batch?.createdAt).toBe('2026-08-17');
        expect(batch?.['exceptions']).toHaveSize(1);
    });

    it('falls back to scanning the list when the endpoint is not there', async () => {
        spyOn(rawApi, 'send').and.rejectWith(
            new Response(null, { status: 404 })
        );
        const getOrderGroups = spyOn(service, 'getOrderGroups').and.resolveTo({
            groups: [{ id: 'batch-2' }, { id: 'batch-1' }],
            totalCount: 2,
        });

        const batch = await service.getOrderGroup('batch-1');

        expect(getOrderGroups).toHaveBeenCalledWith(1, 100);
        expect(batch?.id).toBe('batch-1');
    });
});
