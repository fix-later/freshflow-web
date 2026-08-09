import { TestBed } from '@angular/core/testing';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { RecommendedBasket } from './storefront-landing.types';
import { StorefrontStubService } from './storefront-stub.service';

/** A catalog listing shaped like the one `CatalogService` produces. */
const product = (name: string, overrides: Partial<CatalogProduct> = {}) =>
    ({
        id: `${name}:m1`,
        productId: name,
        marketProductId: `mp-${name}`,
        name,
        nameEn: name,
        description: '',
        descriptionEn: '',
        categoryId: 'c1',
        unit: 'kg',
        unitEn: 'kg',
        marketId: 'm1',
        marketSource: 'Chợ A',
        price: 10000,
        quantity: 5,
        minimumOrderQuantity: 1,
        thumbnail: '',
        images: [],
        active: true,
        featured: false,
        ...overrides,
    }) as CatalogProduct;

const basket = (memberNames: string[]): RecommendedBasket => ({
    id: 'b1',
    businessKindId: 'noodle',
    name: 'Giỏ thử',
    nameEn: 'Test basket',
    memberNames,
    source: 'stub',
});

/**
 * Basket contents are stub data resolved against the real catalogue, so the
 * risk lives entirely in the resolution: a member that resolves to nothing must
 * never become an order line, and a member that differs only by accent or case
 * must still find its product. That is what these cover.
 */
describe('StorefrontStubService basket resolution', () => {
    let service: StorefrontStubService;

    beforeEach(() => {
        TestBed.resetTestingModule();
        service = TestBed.inject(StorefrontStubService);
    });

    it('resolves a member to the real listing and marks it available', () => {
        const lines = service.resolveBasket(basket(['Hành lá']), [
            product('Hành lá'),
        ]);

        expect(lines.length).toBe(1);
        expect(lines[0].product).not.toBeNull();
        expect(lines[0].available).toBe(true);
        expect(lines[0].included).toBe(true);
    });

    it('keeps an unmatched member as an unavailable, excluded line', () => {
        const lines = service.resolveBasket(basket(['Sá sùng']), [
            product('Hành lá'),
        ]);

        // Shown, not dropped: the buyer should learn this market lacks it.
        expect(lines.length).toBe(1);
        expect(lines[0].label).toBe('Sá sùng');
        expect(lines[0].product).toBeNull();
        expect(lines[0].available).toBe(false);
        // The guarantee that stub data cannot enter a real order.
        expect(lines[0].included).toBe(false);
    });

    it('matches regardless of accents, case and spacing', () => {
        const lines = service.resolveBasket(
            basket(['Hành lá', 'GIÁ ĐỖ', 'Cà  chua']),
            [product('hanh la'), product('gia do'), product('Cà chua')]
        );

        expect(lines.map((line) => line.available)).toEqual([true, true, true]);
    });

    it('treats an inactive listing as unavailable', () => {
        const lines = service.resolveBasket(basket(['Hành lá']), [
            product('Hành lá', { active: false }),
        ]);

        expect(lines[0].product).not.toBeNull();
        expect(lines[0].available).toBe(false);
        expect(lines[0].included).toBe(false);
    });

    it('starts a line at the listing minimum, not at one', () => {
        const lines = service.resolveBasket(basket(['Hành lá']), [
            product('Hành lá', { minimumOrderQuantity: 5 }),
        ]);

        // Starting below the minimum would build an order the backend rejects
        // with MINIMUM_ORDER_QUANTITY_NOT_MET at confirmation.
        expect(lines[0].quantity).toBe(5);
    });

    it('marks every stub record so the placeholder data stays greppable', () => {
        expect(
            service.baskets().every((entry) => entry.source === 'stub')
        ).toBe(true);
        expect(
            service.businessKinds().every((entry) => entry.source === 'stub')
        ).toBe(true);
    });

    it('finds the basket for a business kind, and null for an unknown one', () => {
        expect(service.basketFor('noodle')).not.toBeNull();
        expect(service.basketFor('bakery')).toBeNull();
    });
});
