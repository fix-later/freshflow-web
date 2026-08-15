import { marketSessionsApi, ordersApi } from 'contract';
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
         * without one (`'Delivery Address Id' must not be empty`), so the body
         * is the point of the test.
         */
        it('posts the delivery address with the confirm', async () => {
            const post = spyOn(
                ordersApi,
                'apiV1OrdersOrderIdConfirmPostRaw'
            ).and.resolveTo(rawResponse({}));

            await service.confirmOrder('o-3', 'addr-1');

            expect(post).toHaveBeenCalledWith({
                orderId: 'o-3',
                confirmOrderRequest: { deliveryAddressId: 'addr-1' },
            });
        });
    });

    describe('getConfirmPreview', () => {
        it('passes the delivery address the fee is priced from', async () => {
            const get = spyOn(
                ordersApi,
                'apiV1OrdersOrderIdConfirmPreviewGetRaw'
            ).and.resolveTo(
                rawResponse({
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
            );

            const preview = await service.getConfirmPreview('o-4', 'addr-1');

            expect(get).toHaveBeenCalledWith({
                orderId: 'o-4',
                deliveryAddressId: 'addr-1',
            });
            expect(preview.subtotal).toBe(110000);
            expect(preview.deliveryFee).toBe(16250);
            expect(preview.deliveryDistanceKm).toBe(3.25);
            expect(preview.totalAmount).toBe(126250);
        });
    });

    /**
     * `OrderingWindowResponse` is `(dailyCutoffTime, deliveryWindowDays)` and
     * nothing else. The open flag used to be read from four names the backend
     * has never sent, so it defaulted to "open" and the cutoff notice could
     * never appear.
     */
    describe('getOrderingWindow', () => {
        it('derives the cutoff from dailyCutoffTime alone', async () => {
            jasmine.clock().install();
            jasmine.clock().mockDate(new Date(2026, 7, 15, 23, 30));
            spyOn(ordersApi, 'apiV1OrdersOrderingWindowGetRaw').and.resolveTo(
                rawResponse({
                    data: {
                        dailyCutoffTime: '22:00:00',
                        deliveryWindowDays: 7,
                    },
                })
            );

            const window = await service.getOrderingWindow();

            expect(window.isOpen).toBeFalse();
            expect(window.cutoffTime).toBe('22:00:00');
            // Past the cutoff, so the first deliverable day is the one after.
            expect(window.earliestServiceDate).toBe('2026-08-17');
            expect(window.deliveryWindowDays).toBe(7);
            jasmine.clock().uninstall();
        });

        it('stays open before the cutoff, and delivers tomorrow', async () => {
            jasmine.clock().install();
            jasmine.clock().mockDate(new Date(2026, 7, 15, 9, 0));
            spyOn(ordersApi, 'apiV1OrdersOrderingWindowGetRaw').and.resolveTo(
                rawResponse({ data: { dailyCutoffTime: '22:00:00' } })
            );

            const window = await service.getOrderingWindow();

            expect(window.isOpen).toBeTrue();
            expect(window.earliestServiceDate).toBe('2026-08-16');
            jasmine.clock().uninstall();
        });

        it('treats a missing cutoff as unknown rather than closed', async () => {
            spyOn(ordersApi, 'apiV1OrdersOrderingWindowGetRaw').and.resolveTo(
                rawResponse({ data: {} })
            );

            const window = await service.getOrderingWindow();

            expect(window.isOpen).toBeTrue();
            expect(window.earliestServiceDate).toBeNull();
        });
    });

    describe('getMarketSession', () => {
        it('asks for the service date in UTC, so the day survives the client encoding', async () => {
            const get = spyOn(
                marketSessionsApi,
                'apiV1MarketSessionsGetRaw'
            ).and.resolveTo(
                rawResponse({
                    data: [
                        {
                            id: 's-1',
                            marketId: 'm-1',
                            marketName: 'Chợ A',
                            serviceDate: '2026-08-15',
                            status: 'open',
                            closesAt: '2026-08-14T15:00:00Z',
                        },
                    ],
                })
            );

            const session = await service.getMarketSession('m-1', '2026-08-15');

            const sent = get.calls.mostRecent().args[0] as {
                from: Date;
                to: Date;
                marketId: string;
            };
            // What the generated client will put on the wire.
            expect(sent.from.toISOString().substring(0, 10)).toBe('2026-08-15');
            expect(sent.to.toISOString().substring(0, 10)).toBe('2026-08-15');
            expect(sent.marketId).toBe('m-1');
            expect(session?.status).toBe('open');
            expect(session?.closesAt).toBe('2026-08-14T15:00:00Z');
        });

        it('returns null for a day the chợ has no session for', async () => {
            spyOn(marketSessionsApi, 'apiV1MarketSessionsGetRaw').and.resolveTo(
                rawResponse({ data: [] })
            );

            expect(
                await service.getMarketSession('m-1', '2026-08-15')
            ).toBeNull();
        });
    });
});
