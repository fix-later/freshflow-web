import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import { AdminOrderDetail, AdminOrderGroupRow } from '../admin.types';
import { OrderGroupsComponent } from './order-groups.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

/** One completed session carrying two delivered orders. */
const batch: AdminOrderGroupRow = {
    id: 'batch-1',
    batchNumber: 'HM-260822-1',
    status: 'HandedOff',
    isCompleted: true,
    marketId: 'market-1',
    marketName: 'Hóc Môn',
    batchDate: '2026-08-22',
    members: [
        { orderId: 'order-1', status: 'delivered' },
        { orderId: 'order-2', status: 'delivered' },
    ],
} as AdminOrderGroupRow;

function order(id: string, restaurantId: string, total: number) {
    return {
        orderId: id,
        restaurantId,
        totalAmount: total,
    } as AdminOrderDetail;
}

/**
 * The component only for its history helpers: everything they read is a signal
 * this test writes directly, so nothing is fetched.
 */
function createComponent(): OrderGroupsComponent {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        imports: [OrderGroupsComponent],
        providers: [
            provideTransloco({
                config: { availableLangs: ['en'], defaultLang: 'en' },
                loader: StubTranslocoLoader,
            }),
            {
                provide: AdminService,
                useValue: {
                    getOrderGroups: () =>
                        Promise.resolve({ groups: [], totalCount: 0 }),
                    getMarkets: () => Promise.resolve([]),
                    getAgentOptions: () => Promise.resolve([]),
                    getSettledOrder: () => Promise.resolve(null),
                } as unknown as AdminService,
            },
            { provide: Router, useValue: { navigate: () => undefined } },
            {
                provide: ActivatedRoute,
                useValue: {
                    snapshot: {
                        data: { view: 'history' },
                        paramMap: { get: () => null },
                        queryParamMap: { get: () => null },
                    },
                },
            },
        ],
    });
    return TestBed.createComponent(OrderGroupsComponent).componentInstance;
}

describe('OrderGroupsComponent — completed-session figures', () => {
    it('adds up the orders it actually read', () => {
        const component = createComponent();
        component.groups.set([batch]);
        component.historyOrderDetails.set(
            new Map([
                ['order-1', order('order-1', 'restaurant-1', 1250000)],
                ['order-2', order('order-2', 'restaurant-2', 880000)],
            ])
        );

        expect(component.historyGroupInvoice(batch)).toBe(2130000);
        expect(component.historyGroupRestaurantCount(batch)).toBe(2);
        expect(component.historyInvoiceTotal()).toBe(2130000);
    });

    it('reports a session whose order did not load as unknown, not as zero', () => {
        const component = createComponent();
        component.groups.set([batch]);
        // `/orders` is rate limited (30/min per user), so the second read of a
        // long history inside one minute comes back 429 and lands here as a
        // missing entry. Reporting the half it got would understate the money.
        component.historyOrderDetails.set(
            new Map([['order-1', order('order-1', 'restaurant-1', 1250000)]])
        );

        expect(component.historyGroupInvoice(batch)).toBeNull();
        expect(component.historyGroupRestaurantCount(batch)).toBeNull();
        expect(component.historyInvoiceTotal()).toBeNull();
        expect(
            component.historyMoney(component.historyGroupInvoice(batch))
        ).toBe('—');
        expect(
            component.historyCount(component.historyGroupRestaurantCount(batch))
        ).toBe('—');
    });

    it('formats a real total rather than dashing it', () => {
        const component = createComponent();

        expect(component.historyMoney(0)).not.toBe('—');
        expect(component.historyCount(0)).toBe('0');
    });
});

describe('AdminService.getSettledOrder', () => {
    it('reads one finished order once, however many callers ask', async () => {
        const service = TestBed.inject(AdminService);
        const getOrder = spyOn(service, 'getOrder').and.resolveTo(
            order('order-1', 'restaurant-1', 1250000)
        );

        const [first, second] = await Promise.all([
            service.getSettledOrder('order-1'),
            service.getSettledOrder('order-1'),
        ]);
        await service.getSettledOrder('order-1');

        expect(getOrder).toHaveBeenCalledOnceWith('order-1');
        expect(first).toBe(second);
    });

    it('does not remember a failed read, so a retry is a real retry', async () => {
        const service = TestBed.inject(AdminService);
        const getOrder = spyOn(service, 'getOrder').and.rejectWith(
            new Error('429')
        );

        await expectAsync(service.getSettledOrder('order-2')).toBeRejected();

        getOrder.and.resolveTo(order('order-2', 'restaurant-2', 880000));
        await expectAsync(service.getSettledOrder('order-2')).toBeResolvedTo(
            order('order-2', 'restaurant-2', 880000)
        );
        expect(getOrder).toHaveBeenCalledTimes(2);
    });
});
