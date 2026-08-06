import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { UserService } from 'app/core/user/user.service';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { OrdersService } from 'app/modules/orders/orders.service';
import { OrderRow } from 'app/modules/orders/orders.types';
import { ReplaySubject } from 'rxjs';
import { DraftOrderService } from './draft-order.service';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

const product = (id: string): CatalogProduct => ({
    id: `${id}:market-1`,
    productId: id,
    marketProductId: `mp-${id}`,
    name: id,
    nameEn: id,
    description: '',
    descriptionEn: '',
    categoryId: '',
    unit: 'kg',
    unitEn: 'kg',
    marketId: 'market-1',
    marketSource: 'Chợ đầu mối',
    price: 10000,
    quantity: 50,
    minimumOrderQuantity: 1,
    thumbnail: '',
    images: [],
    active: true,
});

/**
 * A draft as `GET /orders` lists it — `OrderListItemDto`, which counts the
 * items but does not carry them. Restoring a cart from this row alone yields
 * nothing, which is why the two stubs below are deliberately different shapes.
 */
const draftListRow = (): OrderRow =>
    ({
        id: 'order-1',
        orderId: 'order-1',
        status: 'draft',
        itemCount: 1,
        totalAmount: 36000,
        createdAt: '2026-08-05T02:00:00Z',
    }) as unknown as OrderRow;

/** The same draft as `GET /orders/{id}` returns it — with its lines. */
const draftOrder = (): OrderRow =>
    ({
        id: 'order-1',
        orderId: 'order-1',
        status: 'draft',
        items: [
            {
                orderItemId: 'item-1',
                marketProductId: 'mp-rau',
                productNameSnapshot: 'Rau muống',
                quantity: 3,
                unitPrice: 12000,
            },
        ],
    }) as unknown as OrderRow;

interface Calls {
    created: { marketProductId: string; quantity: number }[][];
    added: [string, string, number][];
    updated: [string, string, number][];
    removed: [string, string][];
    cancelled: string[];
}

function build(options: {
    signedIn: boolean;
    existingDraft?: OrderRow | null;
}): {
    service: DraftOrderService;
    calls: Calls;
    /** Flips the session on, the way a sign-in (or a reload's profile) does. */
    signIn: () => void;
} {
    const calls: Calls = {
        created: [],
        added: [],
        updated: [],
        removed: [],
        cancelled: [],
    };
    const user = new ReplaySubject<unknown>(1);
    const draft = options.existingDraft ?? null;
    let signedIn = options.signedIn;

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
                        return signedIn
                            ? { id: 'u-1', role: 'restaurant' }
                            : null;
                    },
                },
            },
            {
                provide: OrdersService,
                useValue: {
                    // List and detail answer different DTOs — see the fixtures.
                    listOrders: () =>
                        Promise.resolve({
                            orders: draft ? [draftListRow()] : [],
                            totalCount: draft ? 1 : 0,
                        }),
                    getOrder: () => Promise.resolve(draft),
                    createOrder: (
                        items: { marketProductId: string; quantity: number }[]
                    ) => {
                        calls.created.push(items);
                        return Promise.resolve('order-new');
                    },
                    addItem: (o: string, mp: string, q: number) => {
                        calls.added.push([o, mp, q]);
                        return Promise.resolve();
                    },
                    updateItemQuantity: (o: string, i: string, q: number) => {
                        calls.updated.push([o, i, q]);
                        return Promise.resolve();
                    },
                    removeItem: (o: string, i: string) => {
                        calls.removed.push([o, i]);
                        return Promise.resolve();
                    },
                    cancelOrder: (o: string) => {
                        calls.cancelled.push(o);
                        return Promise.resolve();
                    },
                },
            },
        ],
    });

    return {
        service: TestBed.inject(DraftOrderService),
        calls,
        signIn: () => {
            signedIn = true;
        },
    };
}

/** Lets the optimistic write queue drain. */
const settle = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, 0));

describe('DraftOrderService — the cart is the draft order', () => {
    it('restores the open draft, so a reload does not lose the cart', async () => {
        const { service } = build({
            signedIn: true,
            existingDraft: draftOrder(),
        });

        await service.restore();

        expect(service.orderId()).toBe('order-1');
        expect(service.lines().length).toBe(1);
        const [line] = service.lines();
        expect(line.orderItemId).toBe('item-1');
        expect(line.quantity).toBe(3);
        expect(line.unitPrice).toBe(12000);
        // The order body carries no unit or market, so those degrade to blanks
        // rather than blocking the restore.
        expect(line.product.marketProductId).toBe('mp-rau');
        expect(line.product.name).toBe('Rau muống');
        expect(service.syncState()).toBe('saved');
    });

    it('opens a draft on the first add when none exists', async () => {
        const { service, calls } = build({ signedIn: true });

        service.add(product('ca-chua'));
        await settle();

        expect(calls.created).toEqual([
            [{ marketProductId: 'mp-ca-chua', quantity: 1 }],
        ]);
    });

    it('sends nothing while signed out, and stays local', async () => {
        const { service, calls } = build({ signedIn: false });

        service.add(product('ca-chua'));
        await settle();

        expect(service.lines().length).toBe(1);
        expect(service.orderId()).toBeNull();
        expect(service.syncState()).toBe('local');
        expect(calls.created).toEqual([]);
        expect(calls.added).toEqual([]);
    });

    it('merges a signed-out cart into the draft that was already open', async () => {
        const { service, calls, signIn } = build({
            signedIn: false,
            existingDraft: draftOrder(),
        });
        // Added while browsing signed out — local only, no server id.
        service.add(product('ca-chua'));
        await settle();
        expect(calls.added).toEqual([]);

        signIn();
        await service.restore();

        // The open draft is adopted rather than replaced, and the line the
        // buyer already picked is pushed into it.
        expect(service.orderId()).toBe('order-1');
        expect(calls.created).toEqual([]);
        expect(calls.added).toEqual([['order-1', 'mp-ca-chua', 1]]);
    });

    it('cancels the draft when its last line is removed', async () => {
        const { service, calls } = build({
            signedIn: true,
            existingDraft: draftOrder(),
        });
        await service.restore();

        service.remove(service.lines()[0].product.id);
        await settle();

        expect(calls.cancelled).toEqual(['order-1']);
        expect(service.orderId()).toBeNull();
        // Nothing was deleted line-by-line — an empty draft is an abandoned one.
        expect(calls.removed).toEqual([]);
    });
});
