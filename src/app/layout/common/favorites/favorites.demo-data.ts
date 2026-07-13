import { CatalogProduct } from 'app/modules/catalog/catalog.types';

/**
 * Bundled demo dataset for the header favorites panel — self-contained (not
 * imported from the catalog feature) so the eagerly-loaded header doesn't
 * pull the lazy-loaded catalog module's data into the main bundle. Replace
 * once a per-restaurant "frequently ordered" API exists.
 */
export const DEMO_FAVORITES: CatalogProduct[] = [
    {
        id: 'demo-04',
        name: 'Cà chua bi',
        nameEn: 'Cherry tomatoes',
        description: 'Cà chua bi tươi mỗi ngày, tuyển chọn từ Chợ Thủ Đức.',
        descriptionEn:
            'Cherry tomatoes, hand-picked daily from Thu Duc Market.',
        categoryId: 'c-rau',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Thủ Đức',
        thumbnail: 'images/cards/04-320x200.jpg',
        images: ['images/cards/04-320x200.jpg'],
        active: true,
    },
    {
        id: 'demo-15',
        name: 'Ức gà phi lê',
        nameEn: 'Chicken breast fillet',
        description: 'Ức gà phi lê tươi mỗi ngày, tuyển chọn từ Chợ Bình Điền.',
        descriptionEn:
            'Chicken breast fillet, hand-picked daily from Binh Dien Market.',
        categoryId: 'c-thit',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Bình Điền',
        thumbnail: 'images/cards/15-640x480.jpg',
        images: ['images/cards/15-640x480.jpg'],
        active: true,
    },
    {
        id: 'demo-01',
        name: 'Cải ngọt',
        nameEn: 'Choy sum',
        description: 'Cải ngọt tươi mỗi ngày, tuyển chọn từ Chợ Hóc Môn.',
        descriptionEn: 'Choy sum, hand-picked daily from Hoc Mon Market.',
        categoryId: 'c-rau',
        unit: 'bó',
        unitEn: 'bunch',
        marketSource: 'Chợ Hóc Môn',
        thumbnail: 'images/cards/01-320x200.jpg',
        images: ['images/cards/01-320x200.jpg'],
        active: true,
    },
];
