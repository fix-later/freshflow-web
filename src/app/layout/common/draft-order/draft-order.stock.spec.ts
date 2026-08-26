import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { UserService } from 'app/core/user/user.service';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { OrdersService } from 'app/modules/orders/orders.service';
import { of } from 'rxjs';
import { DraftOrderService } from './draft-order.service';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

/** A listing sold by the case, with `available` kilograms left. */
function product(available: number | null, packWeightKg = 5): CatalogProduct {
    return {
        id: 'p-1:m-1',
        productId: 'p-1',
        marketProductId: 'mp-1',
        name: 'Cá lóc',
        nameEn: 'Snakehead',
        description: '',
        descriptionEn: '',
        categoryId: 'c-1',
        categoryLabel: 'Thuỷ sản',
        unit: 'kilogram',
        unitEn: 'kilogram',
        unitShort: 'kg',
        marketId: 'm-1',
        marketSource: 'Chợ',
        price: 20000,
        quantity: available,
        totalQuantity: available,
        packWeightKg,
        minimumOrderQuantity: 1,
    } as unknown as CatalogProduct;
}

function build(): DraftOrderService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [
            provideTransloco({
                config: { availableLangs: ['vi'], defaultLang: 'vi' },
                loader: StubTranslocoLoader,
            }),
            // A guest cart: local only, so nothing is queued at the server and
            // the rule under test is the one thing exercised.
            { provide: UserService, useValue: { user$: of(null) } },
            {
                provide: OrdersService,
                useValue: {
                    listOrders: () =>
                        Promise.resolve({ orders: [], totalCount: 0 }),
                    getOrder: () => Promise.resolve(null),
                },
            },
        ],
    });
    return TestBed.inject(DraftOrderService);
}

/**
 * The stock ceiling used to live only in the cart page's stepper, so the `+`
 * on a cart row stopped at what the listing had while "add to cart" on a
 * catalog tile or the product page did not — press it enough times and the
 * basket held more than could be sold, which the server then refused at
 * confirm with `INSUFFICIENT_STOCK`. The rule belongs on the write path.
 */
describe('DraftOrderService — stock ceiling', () => {
    it('adds a whole case while the listing can fill one', () => {
        const cart = build();

        cart.add(product(20));

        expect(cart.lines()[0].quantity).toBe(5);
    });

    it('stops at the last whole case the listing can fill', () => {
        const cart = build();
        const fish = product(12); // 2 cases of 5, with 2 kg left over.

        cart.add(fish);
        cart.add(fish);
        cart.add(fish);
        cart.add(fish);

        // 10, not 20: the third and fourth presses had nothing to take.
        expect(cart.lines()[0].quantity).toBe(10);
    });

    it('refuses to add at all when the cart already holds everything', () => {
        const cart = build();
        const fish = product(5);

        cart.add(fish);
        cart.add(fish);

        expect(cart.lines().length).toBe(1);
        expect(cart.lines()[0].quantity).toBe(5);
    });

    it('takes the part of a bulk add that fits, rather than none of it', () => {
        const cart = build();

        cart.add(product(12), 20);

        expect(cart.lines()[0].quantity).toBe(10);
    });

    it('caps a quantity typed straight into the stepper', () => {
        const cart = build();
        const fish = product(12);
        cart.add(fish);

        cart.setQuantity(fish.id, 40);

        expect(cart.lines()[0].quantity).toBe(10);
    });

    it('leaves a listing that reports no stock uncapped', () => {
        const cart = build();
        const unknown = product(null);

        cart.add(unknown);
        cart.add(unknown);

        // A missing count is "not tracked", not "none left" — capping at zero
        // would make such a product unbuyable.
        expect(cart.lines()[0].quantity).toBe(10);
    });

    it('does not add a listing that cannot fill even one case', () => {
        const cart = build();

        cart.add(product(3)); // 3 kg on hand, 5 kg to a case.

        expect(cart.lines()).toEqual([]);
    });
});
