import { DraftOrderLine } from './draft-order.types';

/**
 * Bundled demo dataset for the header draft-order panel — self-contained
 * (not imported from the catalog feature) so the eagerly-loaded header
 * doesn't pull the lazy-loaded catalog module's data into the main bundle.
 * Replace once the order draft lives behind a real M5 (FR-ORD) API.
 */
export const DEMO_DRAFT_ORDER_LINES: DraftOrderLine[] = [
    {
        product: {
            id: 'demo-16:demo-market-thu-duc',
            productId: 'demo-16',
            marketProductId: 'demo-16:demo-market-thu-duc',
            name: 'Xà lách lô lô',
            nameEn: 'Lollo lettuce',
            description:
                'Xà lách lô lô tươi mỗi ngày, tuyển chọn từ Chợ Thủ Đức.',
            descriptionEn:
                'Lollo lettuce, hand-picked daily from Thu Duc Market.',
            categoryId: 'c-rau',
            unit: 'kg',
            unitEn: 'kg',
            marketId: 'demo-market-thu-duc',
            marketSource: 'Chợ Thủ Đức',
            price: 45000,
            quantity: 150,
            thumbnail: 'images/cards/03-320x200.jpg',
            images: ['images/cards/03-320x200.jpg'],
            active: true,
        },
        quantity: 3,
        unitPrice: 45000,
    },
    {
        product: {
            id: 'demo-22:demo-market-binh-dien',
            productId: 'demo-22',
            marketProductId: 'demo-22:demo-market-binh-dien',
            name: 'Tôm sú',
            nameEn: 'Tiger prawns',
            description: 'Tôm sú tươi mỗi ngày, tuyển chọn từ Chợ Bình Điền.',
            descriptionEn:
                'Tiger prawns, hand-picked daily from Binh Dien Market.',
            categoryId: 'c-haisan',
            unit: 'kg',
            unitEn: 'kg',
            marketId: 'demo-market-binh-dien',
            marketSource: 'Chợ Bình Điền',
            price: 285000,
            quantity: 60,
            thumbnail: 'images/cards/16-640x480.jpg',
            images: ['images/cards/16-640x480.jpg'],
            active: true,
        },
        quantity: 2,
        unitPrice: 285000,
    },
];

/** Suggested products for the cart "Có thể bạn quan tâm" section. */
export const DEMO_INTEREST_PRODUCTS: Array<{
    product: DraftOrderLine['product'];
    unitPrice: number;
    rating: number;
    reviews: number;
    badge?: string;
    oldPrice?: number;
}> = [
    {
        product: {
            id: 'demo-interest-1:demo-market-hoc-mon',
            productId: 'demo-interest-1',
            marketProductId: 'demo-interest-1:demo-market-hoc-mon',
            name: 'Cà chua bi',
            nameEn: 'Cherry tomato',
            description: 'Cà chua bi ngọt, thích hợp salad và sốt.',
            descriptionEn: 'Sweet cherry tomatoes for salads and sauces.',
            categoryId: 'c-rau',
            unit: 'kg',
            unitEn: 'kg',
            marketId: 'demo-market-hoc-mon',
            marketSource: 'Chợ Hóc Môn',
            price: 38000,
            quantity: 140,
            thumbnail: 'images/cards/01-320x200.jpg',
            images: ['images/cards/01-320x200.jpg'],
            active: true,
        },
        unitPrice: 38000,
        oldPrice: 46000,
        rating: 4.5,
        reviews: 28,
        badge: 'giảm 17%',
    },
    {
        product: {
            id: 'demo-interest-2:demo-market-binh-dien',
            productId: 'demo-interest-2',
            marketProductId: 'demo-interest-2:demo-market-binh-dien',
            name: 'Ức gà tươi',
            nameEn: 'Fresh chicken breast',
            description: 'Ức gà tươi, ít mỡ, phù hợp suất ăn nhà hàng.',
            descriptionEn: 'Lean chicken breast for restaurant portions.',
            categoryId: 'c-thit',
            unit: 'kg',
            unitEn: 'kg',
            marketId: 'demo-market-binh-dien',
            marketSource: 'Chợ Bình Điền',
            price: 89000,
            quantity: 90,
            thumbnail: 'images/cards/14-320x200.jpg',
            images: ['images/cards/14-320x200.jpg'],
            active: true,
        },
        unitPrice: 89000,
        rating: 5,
        reviews: 41,
        badge: 'mới',
    },
    {
        product: {
            id: 'demo-interest-3:demo-market-thu-duc',
            productId: 'demo-interest-3',
            marketProductId: 'demo-interest-3:demo-market-thu-duc',
            name: 'Nấm bào ngư',
            nameEn: 'Oyster mushroom',
            description: 'Nấm bào ngư trắng, giòn ngọt.',
            descriptionEn: 'Crisp white oyster mushrooms.',
            categoryId: 'c-rau',
            unit: 'kg',
            unitEn: 'kg',
            marketId: 'demo-market-thu-duc',
            marketSource: 'Chợ Thủ Đức',
            price: 52000,
            quantity: 110,
            thumbnail: 'images/cards/08-320x200.jpg',
            images: ['images/cards/08-320x200.jpg'],
            active: true,
        },
        unitPrice: 52000,
        rating: 4,
        reviews: 19,
    },
];
