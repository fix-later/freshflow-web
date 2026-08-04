import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { OrdersService } from 'app/modules/orders/orders.service';
import { OrderConfirmPreview } from 'app/modules/orders/orders.types';
import { RestaurantProfileService } from 'app/modules/restaurant/restaurant-profile.service';
import { CheckoutComponent } from './checkout.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

const preview = (patch: Partial<OrderConfirmPreview>): OrderConfirmPreview => ({
    canConfirm: true,
    blockers: [],
    totalAmount: 1000,
    availableCredit: 9000,
    resolvedScheduledFor: null,
    subtotal: 1000,
    deliveryFee: 0,
    deliveryDistanceKm: null,
    vatAmount: 0,
    ...patch,
});

interface Calls {
    created: number;
    confirmed: string[];
    cancelled: string[];
}

/**
 * `POST /orders` creates a real order in `draft` status, so a blocked or failed
 * attempt leaves one behind. Creating a fresh draft per retry littered the
 * restaurant's own order list with a draft per attempt — which is what made
 * "draft" show up among their order statuses.
 */
function build(previewResult: OrderConfirmPreview): {
    component: CheckoutComponent;
    calls: Calls;
    /** Lets a test unblock the gate between attempts. */
    setPreview(next: OrderConfirmPreview): void;
} {
    const calls: Calls = { created: 0, confirmed: [], cancelled: [] };
    let current = previewResult;
    let next = 0;

    TestBed.configureTestingModule({
        providers: [
            provideTransloco({
                config: { availableLangs: ['vi'], defaultLang: 'vi' },
                loader: StubTranslocoLoader,
            }),
            { provide: Router, useValue: { navigateByUrl: () => undefined } },
            {
                provide: RestaurantProfileService,
                useValue: {
                    loadProfile: () => Promise.resolve(null),
                    loadDeliveryAddresses: () => Promise.resolve([]),
                    // The confirm ships here and the fee is priced from it.
                    defaultDeliveryAddress: () => ({
                        id: 'addr-1',
                        addressLine: 'Test address',
                    }),
                },
            },
            {
                provide: DraftOrderService,
                useValue: {
                    lines: () => [],
                    subtotal: () => 0,
                    clear: () => undefined,
                },
            },
            {
                provide: OrdersService,
                useValue: {
                    createOrder: () => {
                        calls.created += 1;
                        return Promise.resolve(`order-${++next}`);
                    },
                    getConfirmPreview: () => Promise.resolve(current),
                    confirmOrder: (id: string) => {
                        calls.confirmed.push(id);
                        return Promise.resolve();
                    },
                    cancelOrder: (id: string) => {
                        calls.cancelled.push(id);
                        return Promise.resolve();
                    },
                    getLatestOrder: () => Promise.resolve(null),
                    getOrderingWindow: () => Promise.resolve({} as never),
                },
            },
        ],
    });

    return {
        component: TestBed.createComponent(CheckoutComponent).componentInstance,
        calls,
        setPreview: (value: OrderConfirmPreview) => {
            current = value;
        },
    };
}

/** Drives the private pipeline directly; `placeOrder()` guards on a real cart. */
function attempt(
    component: CheckoutComponent,
    items: { marketProductId: string; quantity: number }[],
    when = new Date(2026, 7, 6, 9, 0, 0)
): Promise<void> {
    return (
        component as unknown as {
            _placeOrder(
                items: { marketProductId: string; quantity: number }[],
                scheduledFor: Date,
                notes: string | undefined
            ): Promise<void>;
        }
    )._placeOrder(items, when, undefined);
}

const cart = [{ marketProductId: 'p1', quantity: 2 }];

describe('Checkout draft reuse', () => {
    it('reuses the same draft when a blocked attempt is retried', async () => {
        const { component, calls } = build(
            preview({ canConfirm: false, blockers: ['CREDIT_LIMIT_EXCEEDED'] })
        );

        await attempt(component, cart);
        await attempt(component, cart);
        await attempt(component, cart);

        expect(calls.created).toBe(1);
        expect(calls.confirmed).toEqual([]);
        expect(calls.cancelled).toEqual([]);
        expect(component.blockers()).toEqual(['CREDIT_LIMIT_EXCEEDED']);
    });

    it('confirms the draft it already created once the block clears', async () => {
        const { component, calls, setPreview } = build(
            preview({ canConfirm: false, blockers: ['CREDIT_LIMIT_EXCEEDED'] })
        );

        await attempt(component, cart);
        expect(calls.created).toBe(1);

        // Admin raises the credit limit; the buyer presses Place order again.
        setPreview(preview({}));
        await attempt(component, cart);

        expect(calls.created).toBe(1);
        expect(calls.confirmed).toEqual(['order-1']);
    });

    it('replaces and cancels the stale draft when the order changes', async () => {
        const { component, calls } = build(preview({ canConfirm: false }));

        await attempt(component, cart);
        await attempt(component, [{ marketProductId: 'p1', quantity: 5 }]);

        expect(calls.created).toBe(2);
        expect(calls.cancelled).toEqual(['order-1']);
    });

    it('starts a fresh draft after a successful order', async () => {
        const { component, calls } = build(preview({}));

        await attempt(component, cart);
        expect(calls.confirmed).toEqual(['order-1']);

        await attempt(component, cart);
        expect(calls.created).toBe(2);
        expect(calls.confirmed).toEqual(['order-1', 'order-2']);
        expect(calls.cancelled).toEqual([]);
    });
});
