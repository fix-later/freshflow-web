import { ordersApi, rawApi } from 'contract';
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
        /**
         * The confirm ships to an address and the backend rejects the call
         * without one (`'Delivery Address Id' must not be empty`). The spec
         * snapshot declares no request body for this route, so it goes through
         * `rawApi` rather than the generated client.
         */
        it('posts the delivery address with the confirm', async () => {
            const send = spyOn(rawApi, 'send').and.resolveTo(
                new Response('{}')
            );

            await service.confirmOrder('o-3', 'addr-1');

            expect(send).toHaveBeenCalledWith(
                '/api/v1/orders/o-3/confirm',
                'POST',
                { deliveryAddressId: 'addr-1' }
            );
        });
    });

    describe('getConfirmPreview', () => {
        it('passes the delivery address the fee is priced from', async () => {
            const send = spyOn(rawApi, 'send').and.resolveTo(
                new Response(
                    JSON.stringify({
                        data: {
                            wouldSucceed: true,
                            issues: [],
                            subtotalAmount: 110000,
                            deliveryFee: 16250,
                            deliveryDistanceKm: 3.25,
                            vatAmount: 0,
                            totalAmount: 126250,
                        },
                    })
                )
            );

            const preview = await service.getConfirmPreview('o-4', 'addr-1');

            expect(send).toHaveBeenCalledWith(
                '/api/v1/orders/o-4/confirm-preview',
                'GET',
                undefined,
                { deliveryAddressId: 'addr-1' }
            );
            expect(preview.subtotal).toBe(110000);
            expect(preview.deliveryFee).toBe(16250);
            expect(preview.deliveryDistanceKm).toBe(3.25);
            expect(preview.totalAmount).toBe(126250);
        });
    });
});
