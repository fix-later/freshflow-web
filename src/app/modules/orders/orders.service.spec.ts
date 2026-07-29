import { ordersApi } from 'contract';
import { OrdersService } from './orders.service';

/**
 * Minimal `ApiResponse`-like stub whose `.raw` behaves like a `Response` for
 * `parseJson` (`app/core/api/envelope.ts`), which reads `.text()` — not `.json()`.
 */
function rawResponse(body: unknown): any {
    return {
        raw: {
            text: () =>
                Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
        },
    };
}

describe('OrdersService', () => {
    let service: OrdersService;

    beforeEach(() => {
        service = new OrdersService();
    });

    describe('listOrders', () => {
        it('normalizes rows to carry an id and reads the pagination envelope', async () => {
            spyOn(ordersApi, 'apiV1OrdersGetRaw').and.resolveTo(
                rawResponse({
                    data: {
                        items: [{ orderId: 'o-1', status: 'pending' }],
                        pagination: { total: 1, page: 1, pageSize: 10 },
                    },
                })
            );

            const result = await service.listOrders({ page: 1, pageSize: 10 });

            expect(result.orders).toEqual([
                { orderId: 'o-1', status: 'pending', id: 'o-1' },
            ]);
            expect(result.totalCount).toBe(1);
        });
    });

    describe('createOrder', () => {
        it('sends a CreateDraftOrderRequest and resolves the created order id', async () => {
            const post = spyOn(ordersApi, 'apiV1OrdersPostRaw').and.resolveTo(
                rawResponse({ data: { orderId: 'o-2' } })
            );

            const items = [{ marketProductId: 'mp-1', quantity: 2 }];
            const orderId = await service.createOrder(items, null, 'note');

            expect(post).toHaveBeenCalledWith({
                createDraftOrderRequest: {
                    items,
                    scheduledFor: undefined,
                    notes: 'note',
                },
            });
            expect(orderId).toBe('o-2');
        });

        it('throws when the backend returns no id', async () => {
            spyOn(ordersApi, 'apiV1OrdersPostRaw').and.resolveTo(
                rawResponse({ data: {} })
            );

            await expectAsync(
                service.createOrder([{ marketProductId: 'mp-1' }])
            ).toBeRejected();
        });
    });

    describe('confirmOrder', () => {
        it('calls confirm with the order id', async () => {
            const confirm = spyOn(
                ordersApi,
                'apiV1OrdersOrderIdConfirmPostRaw'
            ).and.resolveTo(rawResponse(undefined));

            await service.confirmOrder('o-3');

            expect(confirm).toHaveBeenCalledWith({ orderId: 'o-3' });
        });
    });
});
