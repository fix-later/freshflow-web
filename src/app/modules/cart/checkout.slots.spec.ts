import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { OrdersService } from 'app/modules/orders/orders.service';
import { OrderRow } from 'app/modules/orders/orders.types';
import { RestaurantProfileService } from 'app/modules/restaurant/restaurant-profile.service';
import { RestaurantProfileView } from 'app/modules/restaurant/restaurant-profile.types';
import { CheckoutComponent } from './checkout.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

const profile = (
    pickupStart: string | null,
    pickupEnd: string | null
): RestaurantProfileView => ({ name: 'Test', pickupStart, pickupEnd });

/**
 * Builds the component with the two reads that shape the slot picker stubbed.
 * `ngOnInit` is not run — it would bounce an empty cart to `/cart` — so the
 * private loader is invoked directly, which is what the picker depends on.
 */
async function build(options: {
    profile?: RestaurantProfileView | null;
    latest?: OrderRow | null;
    profileFails?: boolean;
}): Promise<CheckoutComponent> {
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
                    loadProfile: () =>
                        options.profileFails
                            ? Promise.reject(new Error('boom'))
                            : Promise.resolve(options.profile ?? null),
                    loadDeliveryAddresses: () => Promise.resolve([]),
                    defaultDeliveryAddress: () => null,
                },
            },
            {
                provide: OrdersService,
                useValue: {
                    getLatestOrder: () =>
                        Promise.resolve(options.latest ?? null),
                    getOrderingWindow: () =>
                        Promise.resolve({ isOpen: true } as never),
                },
            },
        ],
    });

    const component =
        TestBed.createComponent(CheckoutComponent).componentInstance;
    await (
        component as unknown as {
            _applyDeliverySlots(): Promise<void>;
        }
    )._applyDeliverySlots();
    return component;
}

describe('Checkout delivery windows', () => {
    it('offers only the window declared on the business profile', async () => {
        const c = await build({ profile: profile('09:00:00', '11:00:00') });
        expect(c.deliverySlots()).toEqual(['09:00-11:00']);
        expect(c.deliverySlot()).toBe('09:00-11:00');
    });

    it('offers every window when the profile declares none', async () => {
        const c = await build({ profile: profile(null, null) });
        expect(c.deliverySlots().length).toBe(4);
    });

    it('preselects the window the last order used', async () => {
        const c = await build({
            profile: profile('06:00:00', '18:00:00'),
            latest: {
                id: 'o1',
                scheduledFor: new Date(2026, 7, 3, 14, 0, 0).toISOString(),
            } as OrderRow,
        });
        expect(c.deliverySlot()).toBe('14:00-16:00');
    });

    it('falls back to the earliest window with no previous order', async () => {
        const c = await build({ profile: profile(null, null), latest: null });
        expect(c.deliverySlot()).toBe('06:00-08:00');
    });

    /**
     * A restaurant that narrows its receiving hours after ordering must not be
     * left preselected on a window checkout no longer offers.
     */
    it('ignores a previous window the profile no longer allows', async () => {
        const c = await build({
            profile: profile('09:00:00', '11:00:00'),
            latest: {
                id: 'o1',
                scheduledFor: new Date(2026, 7, 3, 16, 0, 0).toISOString(),
            } as OrderRow,
        });
        expect(c.deliverySlots()).toEqual(['09:00-11:00']);
        expect(c.deliverySlot()).toBe('09:00-11:00');
    });

    it('keeps the full list when the profile read fails', async () => {
        const c = await build({ profileFails: true });
        expect(c.deliverySlots().length).toBe(4);
        expect(c.deliverySlot()).toBe('06:00-08:00');
    });
});
