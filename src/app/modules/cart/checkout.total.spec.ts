import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { OrdersService } from 'app/modules/orders/orders.service';
import { RestaurantProfileService } from 'app/modules/restaurant/restaurant-profile.service';
import { CartComponent } from './cart.component';
import { CheckoutComponent } from './checkout.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

/**
 * The backend prices an order as the sum of its line subtotals: a confirmed
 * order's `totalAmount` carries no tax and no delivery fee, and that figure is
 * what lands on the credit balance (BR-CRE-1). Checkout used to add an 8% VAT
 * and offer a 10% coupon on top, so the payable it showed overstated the debt
 * by 8% — 3 × 110,000 read as 356,400 against a server total of 330,000.
 */
function configure(subtotal: number): void {
    TestBed.configureTestingModule({
        providers: [
            provideTransloco({
                config: { availableLangs: ['vi'], defaultLang: 'vi' },
                loader: StubTranslocoLoader,
            }),
            { provide: Router, useValue: { navigateByUrl: () => undefined } },
            {
                provide: DraftOrderService,
                useValue: { lines: signal([]), subtotal: signal(subtotal) },
            },
            {
                provide: RestaurantProfileService,
                useValue: {
                    loadProfile: () => Promise.resolve(null),
                    loadDeliveryAddresses: () => Promise.resolve([]),
                    defaultDeliveryAddress: () => null,
                },
            },
            {
                provide: OrdersService,
                useValue: {
                    getLatestOrder: () => Promise.resolve(null),
                    getOrderingWindow: () => Promise.resolve({} as never),
                },
            },
        ],
    });
}

describe('Order total', () => {
    it('checkout charges exactly the goods total', () => {
        configure(330000);
        const component =
            TestBed.createComponent(CheckoutComponent).componentInstance;
        expect(component.total()).toBe(330000);
    });

    it('cart charges exactly the goods total', () => {
        configure(330000);
        const component =
            TestBed.createComponent(CartComponent).componentInstance;
        expect(component.total()).toBe(330000);
    });

    it('an empty cart is free', () => {
        configure(0);
        expect(
            TestBed.createComponent(CheckoutComponent).componentInstance.total()
        ).toBe(0);
    });
});
