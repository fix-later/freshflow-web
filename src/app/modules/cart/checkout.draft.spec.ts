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
    /** Every note written to a draft, in order. */
    /** Every draft edit written, in order. */
    edits: {
        orderId: string;
        notes: string | null;
        scheduledFor: Date | null;
    }[];
}

/**
 * The cart *is* a draft order, and `PATCH /orders/{id}/notes` is what lets
 * checkout put the buyer's note on it. So checkout confirms the cart's own
 * draft instead of opening a second one — which is what used to leave an
 * abandoned draft in the restaurant's order list per checkout attempt.
 */
function build(
    previewResult: OrderConfirmPreview,
    /** Draft the cart already holds; `null` is a cart that has not synced one. */
    cartDraftId: string | null = null
): {
    component: CheckoutComponent;
    calls: Calls;
    setPreview(next: OrderConfirmPreview): void;
} {
    const calls: Calls = {
        created: 0,
        confirmed: [],
        cancelled: [],
        edits: [],
    };
    let current = previewResult;
    let next = 0;
    let adopted: string | null = cartDraftId;

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
                    // Emptying the cart drops the draft it was backed by, the
                    // same as the real service after a confirm.
                    clear: () => {
                        adopted = null;
                    },
                    orderId: () => adopted,
                    adopt: (id: string) => {
                        adopted = id;
                    },
                    // Checkout waits on the cart's item writes before it picks
                    // a draft; nothing is queued here.
                    settled: () => Promise.resolve(),
                },
            },
            {
                provide: OrdersService,
                useValue: {
                    createOrder: () => {
                        calls.created += 1;
                        return Promise.resolve(`order-${++next}`);
                    },
                    updateDraftOrder: (
                        orderId: string,
                        draft: {
                            notes?: string | null;
                            scheduledFor?: Date | null;
                        }
                    ) => {
                        calls.edits.push({
                            orderId,
                            notes: draft.notes ?? null,
                            scheduledFor: draft.scheduledFor ?? null,
                        });
                        return Promise.resolve();
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
    notes?: string
): Promise<void> {
    return (
        component as unknown as {
            _placeOrder(
                items: { marketProductId: string; quantity: number }[],
                notes: string | undefined
            ): Promise<void>;
        }
    )._placeOrder(items, notes);
}

const cart = [{ marketProductId: 'p1', quantity: 2 }];

describe('Checkout draft reuse', () => {
    it('confirms the cart’s own draft instead of creating another', async () => {
        const { component, calls } = build(preview({}), 'cart-draft');

        await attempt(component, cart);

        expect(calls.created).toBe(0);
        expect(calls.confirmed).toEqual(['cart-draft']);
    });

    it('reuses the same draft when a blocked attempt is retried', async () => {
        const { component, calls } = build(
            preview({
                canConfirm: false,
                blockers: [{ code: 'CREDIT_LIMIT_EXCEEDED', message: null }],
            }),
            'cart-draft'
        );

        await attempt(component, cart);
        await attempt(component, cart);
        await attempt(component, cart);

        expect(calls.created).toBe(0);
        expect(calls.confirmed).toEqual([]);
        expect(calls.cancelled).toEqual([]);
        // Localized through the shared code map, not echoed verbatim. The stub
        // loader has no translations, so Transloco answers with the key.
        expect(component.blockers()).toEqual([
            'errors.api.creditLimitExceeded',
        ]);
    });

    it('confirms the draft once the block clears', async () => {
        const { component, calls, setPreview } = build(
            preview({
                canConfirm: false,
                blockers: [{ code: 'CREDIT_LIMIT_EXCEEDED', message: null }],
            }),
            'cart-draft'
        );

        await attempt(component, cart);
        expect(calls.confirmed).toEqual([]);

        // Admin raises the credit limit; the buyer presses Place order again.
        setPreview(preview({}));
        await attempt(component, cart);

        expect(calls.created).toBe(0);
        expect(calls.confirmed).toEqual(['cart-draft']);
    });

    it('writes the note and the picked day onto that draft before confirming it', async () => {
        const { component, calls } = build(preview({}), 'cart-draft');

        await attempt(component, cart, 'Giao trước 5h sáng');

        expect(calls.edits.length).toBe(1);
        const [edit] = calls.edits;
        expect(edit.orderId).toBe('cart-draft');
        expect(edit.notes).toBe('Giao trước 5h sáng');
        // Both fields in one call: the endpoint assigns whatever it is given,
        // so a note-only write would clear the day it had just been told.
        expect(edit.scheduledFor).toEqual(
            component.deliveryDate().set({ hour: 4 }).toJSDate()
        );
        expect(calls.confirmed).toEqual(['cart-draft']);
    });

    it('writes the new day when the picker moves, without touching the note', async () => {
        const { component, calls } = build(
            preview({ canConfirm: false }),
            'cart-draft'
        );

        await attempt(component, cart, 'Ghi chú');
        component.onDeliveryDateChange(
            component.deliveryDate().plus({ days: 1 })
        );
        await attempt(component, cart, 'Ghi chú');

        expect(calls.edits.length).toBe(2);
        expect(calls.edits.map((call) => call.notes)).toEqual([
            'Ghi chú',
            'Ghi chú',
        ]);
        expect(calls.edits[1].scheduledFor?.getTime()).toBeGreaterThan(
            calls.edits[0].scheduledFor!.getTime()
        );
    });

    it('writes once, however many times the order is re-priced', async () => {
        const { component, calls } = build(
            preview({ canConfirm: false }),
            'cart-draft'
        );

        await attempt(component, cart, 'Cùng một ghi chú');
        await attempt(component, cart, 'Cùng một ghi chú');
        await attempt(component, cart, 'Ghi chú đã sửa');

        // Two writes, not three: the second attempt changed nothing.
        expect(calls.edits.map((call) => call.notes)).toEqual([
            'Cùng một ghi chú',
            'Ghi chú đã sửa',
        ]);
    });

    it('opens a draft only when the cart has none to confirm', async () => {
        const { component, calls } = build(preview({ canConfirm: false }));

        await attempt(component, cart);
        // The cart adopts what was created, so the retry confirms that one
        // rather than opening another beside it.
        await attempt(component, cart);

        expect(calls.created).toBe(1);
        expect(calls.cancelled).toEqual([]);
    });

    it('starts a fresh draft after a successful order', async () => {
        const { component, calls } = build(preview({}), 'cart-draft');

        await attempt(component, cart);
        expect(calls.confirmed).toEqual(['cart-draft']);

        // The cart was emptied with the confirm, so the next order is a new
        // draft — not a second confirm of the one just placed.
        await attempt(component, cart);
        expect(calls.created).toBe(1);
        expect(calls.confirmed).toEqual(['cart-draft', 'order-1']);
        expect(calls.cancelled).toEqual([]);
    });
});
