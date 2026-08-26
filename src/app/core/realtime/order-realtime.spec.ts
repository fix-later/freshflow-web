import { TestBed } from '@angular/core/testing';
import { clearTokens, setTokens } from 'contract';
import { FakeHub, fakeHubFactory } from './fake-hub';
import { OrderRealtimeService } from './order-realtime.service';
import { HUB_CONNECTION_FACTORY } from './realtime-connection';

const STATUS_EVENT = {
    orderId: 'order-1',
    restaurantId: 'rest-1',
    previousStatus: 'confirmed',
    newStatus: 'Delivering',
    changedAt: '2026-08-24T01:00:00Z',
    estimatedDeliveryAt: null,
};

const DELIVERY_EVENT = {
    orderId: 'order-2',
    routeId: 'route-1',
    deliveryId: 'delivery-1',
    status: 'arrived',
    occurredAt: '2026-08-24T02:00:00Z',
};

function setup(): {
    service: OrderRealtimeService;
    orders: FakeHub;
    delivery: FakeHub;
} {
    const hubs = new Map<string, FakeHub>();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [
            { provide: HUB_CONNECTION_FACTORY, useValue: fakeHubFactory(hubs) },
        ],
    });
    setTokens('header.eyJzdWIiOiJ1LTEifQ.signature', 'refresh-1');
    const service = TestBed.inject(OrderRealtimeService);
    return {
        service,
        get orders(): FakeHub {
            return hubs.get('orders')!;
        },
        get delivery(): FakeHub {
            return hubs.get('delivery')!;
        },
    };
}

/**
 * Two hubs answer the same question a screen actually asks — *did this order
 * move?* — so both land in `touched`. What must not happen is a screen having
 * to know which hub told it.
 */
describe('OrderRealtimeService', () => {
    afterEach(() => {
        clearTokens();
    });

    it('opens both feeds', async () => {
        const ctx = setup();

        await ctx.service.connect();

        expect(ctx.orders.startCalls).toBe(1);
        expect(ctx.delivery.startCalls).toBe(1);
        expect(ctx.service.connected()).toBeTrue();
    });

    it('reports a status change, lower-casing the status for the screens', async () => {
        const ctx = setup();
        await ctx.service.connect();

        ctx.orders.emit('OrderStatusChanged', STATUS_EVENT);

        expect(ctx.service.touched()?.orderId).toBe('order-1');
        // The backend writes `Delivering`; every status comparison on the web
        // is lower-case.
        expect(ctx.service.touched()?.status).toBe('delivering');
        expect(ctx.service.lastStatusChange()?.previousStatus).toBe(
            'confirmed'
        );
    });

    it('reports both delivery methods through the same signal', async () => {
        const ctx = setup();
        await ctx.service.connect();

        ctx.delivery.emit('DeliveryStarted', DELIVERY_EVENT);
        expect(ctx.service.touched()?.orderId).toBe('order-2');

        ctx.delivery.emit('DeliveryStopUpdated', {
            ...DELIVERY_EVENT,
            orderId: 'order-3',
        });
        expect(ctx.service.touched()?.orderId).toBe('order-3');
        expect(ctx.service.lastDelivery()?.routeId).toBe('route-1');
    });

    it('gives two events for one order distinct identities', async () => {
        const ctx = setup();
        await ctx.service.connect();
        const base = Date.now();
        let tick = 0;
        spyOn(Date, 'now').and.callFake(() => base + ++tick);

        ctx.orders.emit('OrderStatusChanged', STATUS_EVENT);
        const first = ctx.service.touched();
        ctx.orders.emit('OrderStatusChanged', STATUS_EVENT);
        const second = ctx.service.touched();

        // A screen that reloads on each event must see the second one; equal
        // objects would be a signal write that changes nothing.
        expect(second?.at).toBeGreaterThan(first!.at);
    });

    it('drops payloads that do not match the broadcast contract', async () => {
        const ctx = setup();
        await ctx.service.connect();

        ctx.orders.emit('OrderStatusChanged', { orderId: 'order-1' });
        ctx.delivery.emit('DeliveryStarted', 'started');

        expect(ctx.service.touched()).toBeNull();
    });

    it('tells the screen to re-read after either feed reconnects', async () => {
        const ctx = setup();
        await ctx.service.connect();
        let rereads = 0;
        ctx.service.setReconnectHandler(() => rereads++);

        ctx.orders.reconnect();
        ctx.delivery.reconnect();

        // Neither hub replays, so a gap in either one means the screen cannot
        // trust what it is showing.
        expect(rereads).toBe(2);
    });

    it('stops calling a handler a destroyed screen removed', async () => {
        const ctx = setup();
        await ctx.service.connect();
        let rereads = 0;
        ctx.service.setReconnectHandler(() => rereads++);
        ctx.service.setReconnectHandler(null);

        ctx.orders.reconnect();

        expect(rereads).toBe(0);
    });
});
