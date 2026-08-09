import { Injectable } from '@angular/core';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import {
    BasketLine,
    BusinessKind,
    RecommendedBasket,
} from './storefront-landing.types';

/**
 * ⚠️ PLACEHOLDER DATA. Every value below is invented.
 *
 * An audit of both `freshflow-web` and `freshflow-backend` found no endpoint,
 * table, migration, DTO or enum for recommended baskets, business kinds, or
 * market specialities. The landing needs all three, so they live here — in one
 * file, behind one seam, with every record marked `source: 'stub'`.
 *
 * **This is a declared gap, not business logic.** The ingredient lists below are
 * plausible for a Vietnamese kitchen but nobody has confirmed them, and the
 * ingredient counts are properties of this file rather than measurements. See
 * the Gap Register in `specs/004-storefront-landing/plan.md`; product must
 * confirm the real sets before launch.
 *
 * **To replace with a real source**: change the three readers to call the new
 * endpoint. No consuming component changes — they only ever see the interfaces
 * in `storefront-landing.types.ts`.
 */
@Injectable({ providedIn: 'root' })
export class StorefrontStubService {
    private readonly _businessKinds: readonly BusinessKind[] = [
        {
            id: 'noodle',
            name: 'Quán bún, phở',
            nameEn: 'Noodle soup shop',
            marker: '🍜',
            ingredientCount: 12,
            source: 'stub',
        },
        {
            id: 'rice',
            name: 'Quán cơm',
            nameEn: 'Rice shop',
            marker: '🍚',
            ingredientCount: 18,
            source: 'stub',
        },
        {
            id: 'drinks',
            name: 'Quán nước',
            nameEn: 'Drinks stall',
            marker: '🥤',
            ingredientCount: 9,
            source: 'stub',
        },
        {
            id: 'hotpot',
            name: 'Quán lẩu',
            nameEn: 'Hotpot restaurant',
            marker: '🍲',
            ingredientCount: 16,
            source: 'stub',
        },
    ];

    private readonly _baskets: readonly RecommendedBasket[] = [
        {
            id: 'basket-noodle',
            businessKindId: 'noodle',
            name: 'Giỏ quán phở',
            nameEn: 'Noodle shop basket',
            memberNames: [
                'Hành lá',
                'Giá đỗ',
                'Chanh',
                'Ớt',
                'Rau thơm',
                'Hành tây',
            ],
            source: 'stub',
        },
        {
            id: 'basket-rice',
            businessKindId: 'rice',
            name: 'Giỏ quán cơm',
            nameEn: 'Rice shop basket',
            memberNames: [
                'Cà chua',
                'Dưa leo',
                'Cải ngọt',
                'Khoai tây',
                'Cà rốt',
                'Hành tím',
            ],
            source: 'stub',
        },
        {
            id: 'basket-drinks',
            businessKindId: 'drinks',
            name: 'Giỏ quán nước',
            nameEn: 'Drinks stall basket',
            memberNames: ['Chanh', 'Tắc', 'Cam', 'Dứa', 'Gừng'],
            source: 'stub',
        },
        {
            id: 'basket-hotpot',
            businessKindId: 'hotpot',
            name: 'Giỏ quán lẩu',
            nameEn: 'Hotpot basket',
            memberNames: [
                'Cải thảo',
                'Nấm kim châm',
                'Ngò gai',
                'Sả',
                'Ớt',
                'Cà chua',
            ],
            source: 'stub',
        },
    ];

    businessKinds(): readonly BusinessKind[] {
        return this._businessKinds;
    }

    baskets(): readonly RecommendedBasket[] {
        return this._baskets;
    }

    basketFor(businessKindId: string): RecommendedBasket | null {
        return (
            this._baskets.find(
                (basket) => basket.businessKindId === businessKindId
            ) ?? null
        );
    }

    /**
     * Resolves a basket's member names against listings the selected market
     * actually carries.
     *
     * Matching is accent- and case-insensitive because the stub is written with
     * Vietnamese diacritics while catalogue data is entered by hand and often is
     * not. A member that matches nothing comes back with `product: null` and
     * `available: false` — shown to the buyer, excluded from the order. That is
     * the guarantee that stub data can never put a fake product or a fake price
     * into a real order.
     */
    resolveBasket(
        basket: RecommendedBasket,
        products: readonly CatalogProduct[]
    ): BasketLine[] {
        const byName = new Map<string, CatalogProduct>();
        for (const product of products) {
            for (const name of [product.name, product.nameEn]) {
                const key = normalize(name);
                if (key && !byName.has(key)) {
                    byName.set(key, product);
                }
            }
        }

        return basket.memberNames.map((label) => {
            const product = byName.get(normalize(label)) ?? null;
            const available = !!product && product.active;
            return {
                label,
                product,
                // The backend enforces the minimum at confirmation
                // (`MINIMUM_ORDER_QUANTITY_NOT_MET`), so start at it rather
                // than letting the buyer build an order that will be rejected.
                quantity: product?.minimumOrderQuantity ?? 1,
                included: available,
                available,
            };
        });
    }
}

/** Lowercased, accent-stripped, whitespace-collapsed — for tolerant matching. */
function normalize(value: string): string {
    return (
        value
            .normalize('NFD')
            // Combining diacritical marks, which NFD has just split out.
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/gi, 'd')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
    );
}
