import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { OrdersService } from 'app/modules/orders/orders.service';
import { RestaurantProfileService } from 'app/modules/restaurant/restaurant-profile.service';
import { DeliveryAddressView } from 'app/modules/restaurant/restaurant-profile.types';
import { CheckoutComponent } from './checkout.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

/**
 * Delivery is priced by distance from the address's map point. An address saved
 * as text alone quotes 0₫ — which checkout renders as "free delivery", so the
 * restaurant has no way to tell a genuinely free delivery from one the platform
 * could not work out. Checkout has to name that case.
 */
function configure(address: DeliveryAddressView | null): CheckoutComponent {
    TestBed.configureTestingModule({
        providers: [
            provideTransloco({
                config: { availableLangs: ['vi'], defaultLang: 'vi' },
                loader: StubTranslocoLoader,
            }),
            { provide: Router, useValue: { navigateByUrl: () => undefined } },
            {
                provide: DraftOrderService,
                useValue: { lines: signal([]), subtotal: signal(0) },
            },
            {
                provide: RestaurantProfileService,
                useValue: {
                    loadProfile: () => Promise.resolve(null),
                    loadDeliveryAddresses: () => Promise.resolve([]),
                    defaultDeliveryAddress: () => address,
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
    return TestBed.createComponent(CheckoutComponent).componentInstance;
}

describe('Checkout delivery address', () => {
    it('flags an address saved without a map point', () => {
        const component = configure({
            id: 'a1',
            addressLine: 'S601 Vinhomes Grand Park',
        });
        expect(component.addressMissingPin()).toBeTrue();
    });

    it('says nothing when the address carries coordinates', () => {
        const component = configure({
            id: 'a1',
            addressLine: 'S601 Vinhomes Grand Park',
            latitude: 10.84,
            longitude: 106.84,
        });
        expect(component.addressMissingPin()).toBeFalse();
    });

    // No address at all is the "add an address" case, which checkout already
    // states — a missing-point warning on top of it would be noise.
    it('says nothing when there is no address yet', () => {
        expect(configure(null).addressMissingPin()).toBeFalse();
    });
});
