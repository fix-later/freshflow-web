import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { UserService } from 'app/core/user/user.service';
import { OrdersService } from 'app/modules/orders/orders.service';
import { MarketSessionWindow, OrderRow } from 'app/modules/orders/orders.types';
import { ReplaySubject } from 'rxjs';
import { DraftOrderService } from './draft-order.service';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

/**
 * The chợ session the fixtures are anchored to.
 *
 * A session for service date `D` stops taking orders at the cutoff on `D-1`, so
 * the day it trades on is `D-1` — here 2026-08-05 Hanoi time, closing at 22:00
 * (15:00Z). Only drafts opened on that Hanoi day belong to it.
 */
const SERVICE_DATE = '2026-08-06';
const CLOSES_AT = '2026-08-05T15:00:00Z';

/** 09:00 Hanoi on the session's day. */
const SAME_DAY = '2026-08-05T02:00:00Z';
/** 23:00 Hanoi on the session's day — past the cutoff, still the same day. */
const SAME_DAY_LATE = '2026-08-05T16:00:00Z';
/** 21:00 Hanoi the evening before — a different day, so a different session. */
const DAY_BEFORE = '2026-08-04T14:00:00Z';
/** Days old. */
const STALE = '2026-08-01T02:00:00Z';
/**
 * 07:30 Hanoi on the session's day, which is still 2026-08-04 in UTC. Compared
 * in the wrong zone this draft would be thrown away.
 */
const SAME_DAY_EARLY_HANOI = '2026-08-04T23:30:00Z';

const listRow = (id: string, createdAt: string): OrderRow =>
    ({
        id,
        orderId: id,
        status: 'draft',
        itemCount: 1,
        createdAt,
    }) as unknown as OrderRow;

/** `GET /orders/{id}` — the only shape that carries the lines. */
const orderBody = (id: string): OrderRow =>
    ({
        id,
        orderId: id,
        status: 'draft',
        items: [
            {
                orderItemId: `item-${id}`,
                marketProductId: 'mp-rau',
                productNameSnapshot: 'Rau muống',
                quantity: 3,
                unitPrice: 12000,
            },
        ],
    }) as unknown as OrderRow;

const session = (
    patch: Partial<MarketSessionWindow> = {}
): MarketSessionWindow => ({
    id: 'session-1',
    marketId: 'market-1',
    marketName: 'Chợ Đầu Mối',
    serviceDate: SERVICE_DATE,
    status: 'open',
    closesAt: CLOSES_AT,
    ...patch,
});

function build(options: {
    drafts: OrderRow[];
    /** `null` models a buyer who has not picked a chợ yet. */
    marketId?: string | null;
    /** `undefined` keeps the default open session; `null` means none exists. */
    session?: MarketSessionWindow | null;
    /** Makes the session lookup fail, the way an outage would. */
    sessionThrows?: boolean;
}): {
    service: DraftOrderService;
    sessionCalls: [string, string][];
    /** The session stream, so a test can sign in and out. */
    user: ReplaySubject<unknown>;
} {
    const user = new ReplaySubject<unknown>(1);
    const sessionCalls: [string, string][] = [];
    const marketId =
        options.marketId === undefined ? 'market-1' : options.marketId;
    const current = options.session === undefined ? session() : options.session;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [
            provideTransloco({
                config: { availableLangs: ['vi'], defaultLang: 'vi' },
                loader: StubTranslocoLoader,
            }),
            {
                provide: UserService,
                useValue: {
                    user$: user.asObservable(),
                    get current() {
                        return { id: 'u-1', role: 'restaurant' };
                    },
                },
            },
            {
                provide: MarketSelectionService,
                useValue: { selectedId: () => marketId },
            },
            {
                provide: OrdersService,
                useValue: {
                    listOrders: () =>
                        Promise.resolve({
                            orders: options.drafts,
                            totalCount: options.drafts.length,
                        }),
                    getOrder: (id: string) => Promise.resolve(orderBody(id)),
                    getOrderingWindow: () =>
                        Promise.resolve({
                            isOpen: true,
                            cutoffTime: '22:00',
                            earliestServiceDate: SERVICE_DATE,
                            deliveryWindowDays: 7,
                        }),
                    getMarketSession: (m: string, d: string) => {
                        sessionCalls.push([m, d]);
                        return options.sessionThrows
                            ? Promise.reject(new Error('offline'))
                            : Promise.resolve(current);
                    },
                    addItem: () => Promise.resolve(),
                    createOrder: () => Promise.resolve('order-new'),
                    cancelOrder: () => Promise.resolve(),
                },
            },
        ],
    });

    return { service: TestBed.inject(DraftOrderService), sessionCalls, user };
}

describe('DraftOrderService — the cart is this session’s draft', () => {
    it('adopts the newest draft opened on the open session’s day', async () => {
        const { service, sessionCalls } = build({
            drafts: [
                listRow('order-current', SAME_DAY),
                listRow('order-yesterday', DAY_BEFORE),
            ],
        });

        await service.restore();

        expect(service.orderId()).toBe('order-current');
        expect(service.lines().length).toBe(1);
        // The session is the chợ's own, for the day the ordering window says is
        // next deliverable.
        expect(sessionCalls).toEqual([['market-1', SERVICE_DATE]]);
    });

    it('leaves behind a draft opened on an earlier day, so the cart starts clean', async () => {
        const { service } = build({ drafts: [listRow('order-stale', STALE)] });

        await service.restore();

        expect(service.orderId()).toBeNull();
        expect(service.lines()).toEqual([]);
        // Nothing to sync yet — the buyer is starting a fresh basket.
        expect(service.syncState()).toBe('local');
    });

    it('skips a stale draft even when it is the newest of several', async () => {
        // Both are on earlier days; the newest must not win by being newest.
        const { service } = build({
            drafts: [
                listRow('order-newer-but-stale', DAY_BEFORE),
                listRow('order-old', STALE),
            ],
        });

        await service.restore();

        expect(service.orderId()).toBeNull();
    });

    it('adopts nothing while the chợ session is not open', async () => {
        // A draft from today is still today's, but the chợ has stopped taking
        // orders — there is no cart to be building.
        const { service } = build({
            drafts: [listRow('order-today', SAME_DAY)],
            session: session({ status: 'closed' }),
        });

        await service.restore();

        expect(service.orderId()).toBeNull();
    });

    it('adopts nothing while the session is still a draft', async () => {
        const { service } = build({
            drafts: [listRow('order-today', SAME_DAY)],
            session: session({ status: 'draft' }),
        });

        await service.restore();

        expect(service.orderId()).toBeNull();
    });

    it('compares the day in Vietnam time, not UTC', async () => {
        // 07:30 Hanoi on the session's day is still the 4th in UTC. Comparing
        // raw instants would drop a basket the buyer built this morning.
        const { service } = build({
            drafts: [listRow('order-early', SAME_DAY_EARLY_HANOI)],
        });

        await service.restore();

        expect(service.orderId()).toBe('order-early');
    });

    it('keeps a draft opened after the cutoff but still on the session’s day', async () => {
        // The chợ closed at 22:00; a draft opened at 23:00 is past the deadline
        // but on the same Hanoi day, so it is still what the buyer is holding.
        const { service } = build({
            drafts: [listRow('order-late', SAME_DAY_LATE)],
        });

        await service.restore();

        expect(service.orderId()).toBe('order-late');
    });

    it('falls back to the newest draft when no chợ is chosen yet', async () => {
        // Without a market there is no session to read, and losing a basket the
        // buyer just built is worse than restoring one confirm would refuse.
        const { service, sessionCalls } = build({
            drafts: [listRow('order-stale', STALE)],
            marketId: null,
        });

        await service.restore();

        expect(service.orderId()).toBe('order-stale');
        expect(sessionCalls).toEqual([]);
    });

    it('falls back to the newest draft when the session lookup fails', async () => {
        const { service } = build({
            drafts: [listRow('order-stale', STALE)],
            sessionThrows: true,
        });

        await service.restore();

        expect(service.orderId()).toBe('order-stale');
    });

    it('falls back to the newest draft when the day has no session', async () => {
        const { service } = build({
            drafts: [listRow('order-stale', STALE)],
            session: null,
        });

        await service.restore();

        expect(service.orderId()).toBe('order-stale');
    });

    it('falls back to the newest draft when an open session reports no deadline', async () => {
        // Availability answered but the list row did not, so there is no day to
        // compare against.
        const { service } = build({
            drafts: [listRow('order-stale', STALE)],
            session: session({ closesAt: null }),
        });

        await service.restore();

        expect(service.orderId()).toBe('order-stale');
    });

    it('ignores a draft the list did not date', async () => {
        const { service } = build({ drafts: [listRow('order-undated', '')] });

        await service.restore();

        expect(service.orderId()).toBeNull();
    });

    // Signing out is not a reload: without this the next person at this browser
    // opens the cart and finds the last one's order in it.
    it('empties the cart when the session ends', async () => {
        const { service, user } = build({
            drafts: [listRow('order-current', SAME_DAY)],
        });
        user.next({ id: 'u-1', role: 'restaurant' });
        await service.restore();
        expect(service.lines().length).toBe(1);

        user.next(null);

        expect(service.lines()).toEqual([]);
        expect(service.orderId()).toBeNull();
    });
});
