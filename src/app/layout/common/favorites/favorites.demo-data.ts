import { CatalogProduct } from 'app/modules/catalog/catalog.types';

/**
 * Bundled demo dataset for the header favorites panel — self-contained (not
 * imported from the catalog feature) so the eagerly-loaded header doesn't
 * pull the lazy-loaded catalog module's data into the main bundle. Replace
 * once a per-restaurant "frequently ordered" API exists.
 */
export const DEMO_FAVORITES: CatalogProduct[] = [
    {
        id: 'demo-04:demo-market-thu-duc',
        productId: 'demo-04',
        marketProductId: 'demo-04:demo-market-thu-duc',
        name: 'Cà chua bi',
        nameEn: 'Cherry tomatoes',
        description: 'Cà chua bi tươi mỗi ngày, tuyển chọn từ Chợ Thủ Đức.',
        descriptionEn:
            'Cherry tomatoes, hand-picked daily from Thu Duc Market.',
        categoryId: 'c-rau',
        unit: 'kg',
        unitEn: 'kg',
        marketId: 'demo-market-thu-duc',
        marketSource: 'Chợ Thủ Đức',
        price: 45000,
        quantity: 120,
        thumbnail: 'images/cards/04-320x200.jpg',
        images: ['images/cards/04-320x200.jpg'],
        active: true,
    },
    {
        id: 'demo-15:demo-market-binh-dien',
        productId: 'demo-15',
        marketProductId: 'demo-15:demo-market-binh-dien',
        name: 'Ức gà phi lê',
        nameEn: 'Chicken breast fillet',
        description: 'Ức gà phi lê tươi mỗi ngày, tuyển chọn từ Chợ Bình Điền.',
        descriptionEn:
            'Chicken breast fillet, hand-picked daily from Binh Dien Market.',
        categoryId: 'c-thit',
        unit: 'kg',
        unitEn: 'kg',
        marketId: 'demo-market-binh-dien',
        marketSource: 'Chợ Bình Điền',
        price: 89000,
        quantity: 80,
        thumbnail: 'images/cards/15-640x480.jpg',
        images: ['images/cards/15-640x480.jpg'],
        active: true,
    },
    {
        id: 'demo-01:demo-market-hoc-mon',
        productId: 'demo-01',
        marketProductId: 'demo-01:demo-market-hoc-mon',
        name: 'Cải ngọt',
        nameEn: 'Choy sum',
        description: 'Cải ngọt tươi mỗi ngày, tuyển chọn từ Chợ Hóc Môn.',
        descriptionEn: 'Choy sum, hand-picked daily from Hoc Mon Market.',
        categoryId: 'c-rau',
        unit: 'bó',
        unitEn: 'bunch',
        marketId: 'demo-market-hoc-mon',
        marketSource: 'Chợ Hóc Môn',
        price: 12000,
        quantity: 200,
        thumbnail: 'images/cards/01-320x200.jpg',
        images: ['images/cards/01-320x200.jpg'],
        active: true,
    },
];
