import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { UserService } from 'app/core/user/user.service';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { OrdersService } from 'app/modules/orders/orders.service';
import { OrderRow } from 'app/modules/orders/orders.types';
import { of } from 'rxjs';
import { AssistantReply, AssistantService } from './assistant.service';
import { QuickBuyComponent } from './quick-buy.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

function reply(patch: Partial<AssistantReply> = {}): AssistantReply {
    return {
        reply: 'Đã gom giúp bạn.',
        sessionId: 's-1',
        pendingConfirmation: null,
        draftOrderId: null,
        creditSummary: null,
        deliveryAddresses: null,
        ...patch,
    };
}

/** The composer is the only way into the conversation, so the tests use it too. */
function ask(component: QuickBuyComponent, text: string): void {
    component.query.set(text);
    component.send();
}

function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * The draft card is the assistant handing an order over. Two things must hold
 * however the conversation goes: the figures come from the order rather than
 * from what the model said, and the card never becomes a second way to place an
 * order — it navigates, and confirmation stays behind its own button.
 */
describe('QuickBuyComponent — draft order card', () => {
    let assistant: jasmine.SpyObj<AssistantService>;
    let orders: jasmine.SpyObj<OrdersService>;
    let cart: {
        adopt: jasmine.Spy;
        settled: jasmine.Spy;
        orderId: ReturnType<typeof signal<string | null>>;
    };
    let router: jasmine.SpyObj<Router>;

    function createComponent(): QuickBuyComponent {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [QuickBuyComponent],
            providers: [
                provideTransloco({
                    config: { availableLangs: ['vi'], defaultLang: 'vi' },
                    loader: StubTranslocoLoader,
                }),
                { provide: AssistantService, useValue: assistant },
                { provide: OrdersService, useValue: orders },
                { provide: DraftOrderService, useValue: cart },
                { provide: Router, useValue: router },
                {
                    provide: UserService,
                    useValue: { user$: of({ id: 'u1', role: 'restaurant' }) },
                },
                {
                    provide: PermissionsService,
                    useValue: {
                        hasRole: (role: string) => role === 'restaurant',
                        isApproved: () => true,
                    },
                },
            ],
        });
        return TestBed.createComponent(QuickBuyComponent).componentInstance;
    }

    beforeEach(() => {
        assistant = jasmine.createSpyObj<AssistantService>(
            'AssistantService',
            [
                'chat',
                'takeStarter',
                'restoredMessages',
                'restoredDraftOrderId',
                'persist',
                'forget',
            ],
            { opened: signal(false) }
        );
        assistant.takeStarter.and.returnValue(null);
        // A fresh browser: nothing was stored by a previous page.
        assistant.restoredMessages.and.returnValue([]);
        assistant.restoredDraftOrderId.and.returnValue(null);
        orders = jasmine.createSpyObj<OrdersService>('OrdersService', [
            'getOrder',
        ]);
        cart = {
            adopt: jasmine.createSpy('adopt'),
            settled: jasmine.createSpy('settled').and.resolveTo(undefined),
            orderId: signal<string | null>(null),
        };
        router = jasmine.createSpyObj<Router>('Router', ['navigate']);
        router.navigate.and.resolveTo(true);
    });

    it('describes the draft from the order, not from the reply', async () => {
        assistant.chat.and.resolveTo(
            reply({ reply: 'Tổng 1 tỉ đồng', draftOrderId: 'order-1' })
        );
        orders.getOrder.and.resolveTo({
            orderId: 'order-1',
            itemCount: 3,
            totalAmount: 450_000,
        } as OrderRow);

        const component = createComponent();
        ask(component, '20kg cải ngọt');
        await flush();

        expect(orders.getOrder).toHaveBeenCalledWith('order-1');
        expect(component.draft()).toEqual({
            id: 'order-1',
            itemCount: 3,
            total: 450_000,
            unreadable: false,
        });
    });

    it('follows the same draft as it grows instead of stacking cards', async () => {
        assistant.chat.and.resolveTo(reply({ draftOrderId: 'order-1' }));
        orders.getOrder.and.resolveTo({
            orderId: 'order-1',
            itemCount: 1,
            totalAmount: 100_000,
        } as OrderRow);
        const component = createComponent();
        ask(component, 'một thùng cà chua');
        await flush();
        expect(component.draft()?.itemCount).toBe(1);

        orders.getOrder.and.resolveTo({
            orderId: 'order-1',
            itemCount: 2,
            totalAmount: 260_000,
        } as OrderRow);
        ask(component, 'thêm 5kg dưa leo');
        await flush();

        expect(component.draft()).toEqual({
            id: 'order-1',
            itemCount: 2,
            total: 260_000,
            unreadable: false,
        });
    });

    it('shows nothing for a draft with no lines', async () => {
        assistant.chat.and.resolveTo(reply({ draftOrderId: 'order-1' }));
        orders.getOrder.and.resolveTo({
            orderId: 'order-1',
            itemCount: 0,
        } as OrderRow);

        const component = createComponent();
        ask(component, 'chào');
        await flush();

        expect(component.draft()).toBeNull();
    });

    it('says so when the draft cannot be read back', async () => {
        assistant.chat.and.resolveTo(reply({ draftOrderId: 'order-1' }));
        orders.getOrder.and.rejectWith(new Error('gone'));

        const component = createComponent();
        ask(component, 'đặt hàng');
        await flush();

        expect(component.draft()?.unreadable).toBe(true);
    });

    it('hands the draft to the cart and opens checkout', async () => {
        assistant.chat.and.resolveTo(reply({ draftOrderId: 'order-1' }));
        orders.getOrder.and.resolveTo({
            orderId: 'order-1',
            itemCount: 2,
            totalAmount: 260_000,
        } as OrderRow);
        cart.adopt.and.callFake((id: string) => cart.orderId.set(id));

        const component = createComponent();
        ask(component, 'đặt hàng');
        await flush();
        await component.openDraftCheckout();

        expect(cart.adopt).toHaveBeenCalledWith('order-1');
        expect(router.navigate).toHaveBeenCalledWith(['/checkout']);
        // It navigates; it never confirms — no turn carries a confirmOrderId.
        for (const call of assistant.chat.calls.all()) {
            expect(call.args[1]?.confirmOrderId).toBeUndefined();
        }
    });

    it('refuses to send the buyer to a checkout the draft has left', async () => {
        assistant.chat.and.resolveTo(reply({ draftOrderId: 'order-1' }));
        orders.getOrder.and.resolveTo({
            orderId: 'order-1',
            itemCount: 2,
            totalAmount: 260_000,
        } as OrderRow);
        // The cart could not hold it — `_reload` drops an order it cannot read.
        cart.adopt.and.callFake(() => cart.orderId.set(null));

        const component = createComponent();
        ask(component, 'đặt hàng');
        await flush();
        await component.openDraftCheckout();

        expect(router.navigate).not.toHaveBeenCalled();
        expect(component.draft()?.unreadable).toBe(true);
    });
});
