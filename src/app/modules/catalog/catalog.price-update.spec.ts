import { TestBed } from '@angular/core/testing';
import { CatalogService } from './catalog.service';
import type { CatalogProduct } from './catalog.types';

/** Minimal listing row — only the fields this behaviour reads or writes. */
function product(overrides: Partial<CatalogProduct>): CatalogProduct {
    return {
        id: 'p-1:market-1',
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
        marketId: 'market-1',
        marketSource: 'Chợ Bình Điền',
        price: 100_000,
        quantity: 30,
        totalQuantity: 50,
        ...overrides,
    } as CatalogProduct;
}

/**
 * `PriceUpdated` carries a new price and stock **on hand**. It does not carry
 * availability, which is stock minus what open orders have reserved — so the
 * one field the storefront sells against must not be overwritten from it.
 */
describe('CatalogService.applyPriceUpdate', () => {
    let service: CatalogService;

    beforeEach(() => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({});
        service = TestBed.inject(CatalogService);
    });

    /** Seeds the listing the way a market read would have. */
    function seed(products: CatalogProduct[]): void {
        (
            service as unknown as {
                _products: { set: (value: CatalogProduct[]) => void };
            }
        )._products.set(products);
    }

    it('writes the new price onto the matching listing row', () => {
        seed([product({}), product({ marketProductId: 'mp-2', id: 'p-2' })]);

        service.applyPriceUpdate({
            marketProductId: 'mp-1',
            newPrice: 135_000,
            currentQuantity: 44,
        });

        const [first, second] = service.products();
        expect(first.price).toBe(135_000);
        expect(second.price).toBe(100_000);
    });

    it('treats currentQuantity as stock on hand, not as availability', () => {
        seed([product({ quantity: 30, totalQuantity: 50 })]);

        service.applyPriceUpdate({
            marketProductId: 'mp-1',
            newPrice: 135_000,
            currentQuantity: 44,
        });

        const [row] = service.products();
        expect(row.totalQuantity).toBe(44);
        // Availability is what other buyers' open orders left behind — the
        // pricing hub does not know it, and offering 44 when 30 can be ordered
        // would oversell.
        expect(row.quantity).toBe(30);
    });

    it('ignores a listing row it does not hold', () => {
        seed([product({})]);

        service.applyPriceUpdate({
            marketProductId: 'mp-elsewhere',
            newPrice: 1,
            currentQuantity: 1,
        });

        expect(service.products()[0].price).toBe(100_000);
    });

    it('updates the open product page as well as the grid', () => {
        seed([product({})]);
        (
            service as unknown as {
                _product: { set: (value: CatalogProduct) => void };
            }
        )._product.set(product({}));

        service.applyPriceUpdate({
            marketProductId: 'mp-1',
            newPrice: 150_000,
            currentQuantity: 10,
        });

        expect(service.product()?.price).toBe(150_000);
        expect(service.product()?.totalQuantity).toBe(10);
    });
});
