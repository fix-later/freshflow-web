import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { UserService } from 'app/core/user/user.service';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { OrdersService } from 'app/modules/orders/orders.service';
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
        reply: 'Đây là thông tin bạn hỏi.',
        sessionId: 's-1',
        pendingConfirmation: null,
        draftOrderId: null,
        creditSummary: null,
        deliveryAddresses: null,
        ...patch,
    };
}

const address = (patch: Record<string, unknown> = {}) => ({
    id: 'addr-1',
    addressLine: '25 Lê Lợi, Quận 1',
    recipientName: 'Trần Văn A',
    phone: '0901234567',
    isDefault: false,
    ...patch,
});

function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * The answer carries two things the model is deliberately never shown — the
 * restaurant's credit and its delivery addresses — so the assistant's reply
 * says they are "on screen". They only are if this panel renders them.
 *
 * Both are attached to the *message* that carried them, not to a signal
 * floating at the top of the panel: an answer belongs under the question that
 * asked it, so a credit card pinned above the whole thread would drift below
 * later questions and read out of order.
 */
describe('QuickBuyComponent — what the answer carries', () => {
    let assistant: jasmine.SpyObj<AssistantService>;

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
                {
                    provide: OrdersService,
                    useValue: jasmine.createSpyObj<OrdersService>(
                        'OrdersService',
                        ['getOrder']
                    ),
                },
                {
                    provide: DraftOrderService,
                    useValue: {
                        adopt: jasmine.createSpy('adopt'),
                        settled: jasmine
                            .createSpy('settled')
                            .and.resolveTo(undefined),
                        orderId: signal<string | null>(null),
                    },
                },
                {
                    provide: Router,
                    useValue: jasmine.createSpyObj<Router>('Router', [
                        'navigate',
                    ]),
                },
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

    function ask(component: QuickBuyComponent, text: string): void {
        component.query.set(text);
        component.send();
    }

    /** The last message in the thread — the one a fresh answer just wrote. */
    function lastMessage(component: QuickBuyComponent) {
        const messages = component.messages();
        return messages[messages.length - 1];
    }

    beforeEach(() => {
        assistant = jasmine.createSpyObj<AssistantService>(
            'AssistantService',
            [
                'chat',
                'takeStarter',
                'restoredMessages',
                'restoredDraftOrderId',
                'restoredSelectedAddressId',
                'persist',
                'forget',
            ],
            { opened: signal(false) }
        );
        assistant.takeStarter.and.returnValue(null);
        assistant.restoredMessages.and.returnValue([]);
        assistant.restoredDraftOrderId.and.returnValue(null);
        assistant.restoredSelectedAddressId.and.returnValue(null);
        assistant.chat.and.resolveTo(reply());
    });

    it('attaches the credit the answer carried to that turn', async () => {
        assistant.chat.and.resolveTo(
            reply({
                creditSummary: {
                    creditLimit: 100_000_000,
                    outstandingBalance: 3_979_800,
                    availableCredit: 96_020_200,
                    updatedAt: '2026-09-03T11:18:16Z',
                },
            })
        );

        const component = createComponent();
        ask(component, 'còn bao nhiêu công nợ');
        await flush();

        expect(lastMessage(component).credit?.availableCredit).toBe(96_020_200);
    });

    // A balance answered once stays on the turn that answered it — a later
    // turn that says nothing about credit must not erase or replace it.
    it('leaves an earlier turn credit card where it was said', async () => {
        const component = createComponent();
        assistant.chat.and.resolveTo(
            reply({
                creditSummary: {
                    creditLimit: 1,
                    outstandingBalance: 0,
                    availableCredit: 1,
                    updatedAt: null,
                },
            })
        );
        ask(component, 'công nợ');
        await flush();
        const creditMessageIndex = component.messages().length - 1;

        assistant.chat.and.resolveTo(reply());
        ask(component, 'cảm ơn');
        await flush();

        expect(component.messages()[creditMessageIndex].credit).not.toBeNull();
        // The later turn's own message carries no credit of its own.
        expect(lastMessage(component).credit).toBeFalsy();
    });

    it('picks the default address so the order has somewhere to go', async () => {
        assistant.chat.and.resolveTo(
            reply({
                deliveryAddresses: [
                    address(),
                    address({ id: 'addr-2', isDefault: true }),
                ],
            })
        );

        const component = createComponent();
        ask(component, 'giao tới đâu');
        await flush();

        expect(lastMessage(component).addresses?.length).toBe(2);
        expect(component.selectedAddressId()).toBe('addr-2');
    });

    /**
     * The model is never allowed to choose the address — the server injects
     * whatever the client sends — so a picked address has to reach the next
     * turn or the choice means nothing.
     */
    it('sends the picked address on the next turn', async () => {
        assistant.chat.and.resolveTo(reply({ deliveryAddresses: [address()] }));
        const component = createComponent();
        ask(component, 'giao tới đâu');
        await flush();

        assistant.chat.and.resolveTo(reply());
        ask(component, 'đặt giúp mình');
        await flush();

        expect(assistant.chat).toHaveBeenCalledWith(
            'đặt giúp mình',
            jasmine.objectContaining({ deliveryAddressId: 'addr-1' })
        );
    });

    it('lets the buyer un-pick an address', async () => {
        assistant.chat.and.resolveTo(reply({ deliveryAddresses: [address()] }));
        const component = createComponent();
        ask(component, 'giao tới đâu');
        await flush();
        expect(component.selectedAddressId()).toBe('addr-1');

        component.selectAddress(lastMessage(component).addresses![0]);

        expect(component.selectedAddressId()).toBeNull();
    });
});
