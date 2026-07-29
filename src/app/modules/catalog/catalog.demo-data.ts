import { CatalogCategory, CatalogProduct } from './catalog.types';

/**
 * Demo dataset: served by CatalogService whenever the products API is
 * unreachable or empty, so the catalog is browsable during development and
 * demos. Delete once the backend is seeded.
 */

export const DEMO_CATEGORIES: CatalogCategory[] = [
    {
        id: 'c-rau',
        name: 'Rau củ',
        nameEn: 'Vegetables',
        slug: 'rau-cu',
        icon: '🥦',
    },
    {
        id: 'c-traicay',
        name: 'Trái cây',
        nameEn: 'Fruits',
        slug: 'trai-cay',
        icon: '🍓',
    },
    {
        id: 'c-thit',
        name: 'Thịt & gia cầm',
        nameEn: 'Meat & Poultry',
        slug: 'thit-gia-cam',
        icon: '🥩',
    },
    {
        id: 'c-haisan',
        name: 'Hải sản',
        nameEn: 'Seafood',
        slug: 'hai-san',
        icon: '🦐',
    },
    {
        id: 'c-trung',
        name: 'Trứng & sữa',
        nameEn: 'Eggs & Dairy',
        slug: 'trung-sua',
        icon: '🥚',
    },
    {
        id: 'c-banh',
        name: 'Bánh mì & bánh ngọt',
        nameEn: 'Bakery',
        slug: 'banh-mi',
        icon: '🍞',
    },
    {
        id: 'c-douong',
        name: 'Đồ uống',
        nameEn: 'Beverages',
        slug: 'do-uong',
        icon: '🧃',
    },
    {
        id: 'c-giavi',
        name: 'Gia vị & đồ khô',
        nameEn: 'Spices & Dry Goods',
        slug: 'gia-vi',
        icon: '🧂',
    },
];

/** Available demo thumbnails (bundled Fuse card images). */
const THUMBS = [
    ...Array.from(
        { length: 10 },
        (_, i) => `images/cards/${String(i + 1).padStart(2, '0')}-320x200.jpg`
    ),
    ...Array.from(
        { length: 17 },
        (_, i) => `images/cards/${String(i + 14).padStart(2, '0')}-640x480.jpg`
    ),
];

let seq = 0;

const MARKET_IDS: Record<string, string> = {
    'Chợ Bình Điền': 'demo-market-binh-dien',
    'Chợ Hóc Môn': 'demo-market-hoc-mon',
    'Chợ Thủ Đức': 'demo-market-thu-duc',
};

function demo(
    name: string,
    nameEn: string,
    categoryId: string,
    unit: string,
    unitEn: string,
    marketSource: string
): CatalogProduct {
    seq += 1;
    const productId = `demo-${String(seq).padStart(2, '0')}`;
    return {
        id: `${productId}:${MARKET_IDS[marketSource]}`,
        productId,
        marketProductId: `${productId}:${MARKET_IDS[marketSource]}`,
        name,
        nameEn,
        description: `${name} tươi mỗi ngày, tuyển chọn từ ${marketSource}.`,
        descriptionEn: `${nameEn}, hand-picked daily from ${marketSource}.`,
        categoryId,
        unit,
        unitEn,
        marketId: MARKET_IDS[marketSource],
        marketSource,
        // Deterministic placeholder price (VND) — varies by item, not real pricing.
        price: 15000 + ((seq * 4231) % 235000),
        quantity: 100 + ((seq * 37) % 400),
        thumbnail: THUMBS[(seq - 1) % THUMBS.length],
        images: [THUMBS[(seq - 1) % THUMBS.length]],
        active: seq % 9 !== 0,
    };
}

const BINH_DIEN = 'Chợ Bình Điền';
const HOC_MON = 'Chợ Hóc Môn';
const THU_DUC = 'Chợ Thủ Đức';

export const DEMO_PRODUCTS: CatalogProduct[] = [
    // Rau củ
    demo('Cải ngọt', 'Choy sum', 'c-rau', 'bó', 'bunch', HOC_MON),
    demo('Rau muống', 'Water spinach', 'c-rau', 'bó', 'bunch', HOC_MON),
    demo('Xà lách lô lô', 'Lollo lettuce', 'c-rau', 'kg', 'kg', THU_DUC),
    demo('Cà chua bi', 'Cherry tomatoes', 'c-rau', 'kg', 'kg', THU_DUC),
    demo('Khoai tây Đà Lạt', 'Da Lat potatoes', 'c-rau', 'kg', 'kg', THU_DUC),
    demo(
        'Hành tím Vĩnh Châu',
        'Vinh Chau shallots',
        'c-rau',
        'kg',
        'kg',
        HOC_MON
    ),
    demo(
        'Nấm kim châm',
        'Enoki mushrooms',
        'c-rau',
        'gói 200g',
        '200g pack',
        THU_DUC
    ),
    demo('Bí đỏ hồ lô', 'Butternut squash', 'c-rau', 'kg', 'kg', HOC_MON),

    // Trái cây
    demo(
        'Cam sành Vĩnh Long',
        'Vinh Long king oranges',
        'c-traicay',
        'kg',
        'kg',
        THU_DUC
    ),
    demo('Chanh không hạt', 'Seedless limes', 'c-traicay', 'kg', 'kg', HOC_MON),
    demo(
        'Chuối già Nam Mỹ',
        'Cavendish bananas',
        'c-traicay',
        'nải',
        'hand',
        THU_DUC
    ),
    demo(
        'Xoài cát Hòa Lộc',
        'Hoa Loc mangoes',
        'c-traicay',
        'kg',
        'kg',
        THU_DUC
    ),
    demo(
        'Dưa hấu ruột đỏ',
        'Red watermelon',
        'c-traicay',
        'trái',
        'piece',
        HOC_MON
    ),
    demo(
        'Táo Fuji nhập khẩu',
        'Imported Fuji apples',
        'c-traicay',
        'thùng 9kg',
        '9kg case',
        THU_DUC
    ),

    // Thịt & gia cầm
    demo('Ba chỉ heo', 'Pork belly', 'c-thit', 'kg', 'kg', HOC_MON),
    demo('Sườn non heo', 'Pork spare ribs', 'c-thit', 'kg', 'kg', HOC_MON),
    demo(
        'Thăn bò ngoại',
        'Imported beef tenderloin',
        'c-thit',
        'kg',
        'kg',
        BINH_DIEN
    ),
    demo(
        'Ức gà phi lê',
        'Chicken breast fillet',
        'c-thit',
        'kg',
        'kg',
        HOC_MON
    ),
    demo(
        'Đùi gà góc tư',
        'Chicken leg quarters',
        'c-thit',
        'thùng 10kg',
        '10kg case',
        HOC_MON
    ),
    demo(
        'Gà ta nguyên con',
        'Whole free-range chicken',
        'c-thit',
        'con',
        'whole bird',
        HOC_MON
    ),

    // Hải sản
    demo(
        'Tôm thẻ tươi',
        'Fresh white shrimp',
        'c-haisan',
        'kg',
        'kg',
        BINH_DIEN
    ),
    demo('Cá basa phi lê', 'Basa fillet', 'c-haisan', 'kg', 'kg', BINH_DIEN),
    demo('Mực ống lá', 'Squid tubes', 'c-haisan', 'kg', 'kg', BINH_DIEN),
    demo(
        'Cá thu cắt khúc',
        'Mackerel steaks',
        'c-haisan',
        'kg',
        'kg',
        BINH_DIEN
    ),
    demo(
        'Nghêu trắng Bến Tre',
        'Ben Tre white clams',
        'c-haisan',
        'kg',
        'kg',
        BINH_DIEN
    ),
    demo(
        'Cua thịt Cà Mau',
        'Ca Mau mud crabs',
        'c-haisan',
        'kg',
        'kg',
        BINH_DIEN
    ),

    // Trứng & sữa
    demo(
        'Trứng gà công nghiệp',
        'Farm chicken eggs',
        'c-trung',
        'vỉ 30 trứng',
        'tray of 30',
        HOC_MON
    ),
    demo(
        'Trứng vịt tươi',
        'Fresh duck eggs',
        'c-trung',
        'vỉ 30 trứng',
        'tray of 30',
        HOC_MON
    ),
    demo(
        'Trứng cút',
        'Quail eggs',
        'c-trung',
        'hộp 100 trứng',
        'box of 100',
        HOC_MON
    ),
    demo(
        'Sữa tươi thanh trùng',
        'Pasteurized fresh milk',
        'c-trung',
        'thùng 12 hộp',
        'case of 12',
        THU_DUC
    ),
    demo(
        'Phô mai mozzarella',
        'Mozzarella cheese',
        'c-trung',
        'khối 2.5kg',
        '2.5kg block',
        THU_DUC
    ),
    demo(
        'Bơ lạt',
        'Unsalted butter',
        'c-trung',
        'thùng 10kg',
        '10kg case',
        THU_DUC
    ),

    // Bánh mì & bánh ngọt
    demo('Bánh mì baguette', 'Baguette', 'c-banh', 'ổ', 'loaf', THU_DUC),
    demo(
        'Bánh sandwich lát',
        'Sliced sandwich bread',
        'c-banh',
        'ổ 500g',
        '500g loaf',
        THU_DUC
    ),
    demo(
        'Bánh burger',
        'Burger buns',
        'c-banh',
        'túi 12 cái',
        'bag of 12',
        THU_DUC
    ),
    demo(
        'Bột mì số 13',
        'Bread flour no. 13',
        'c-banh',
        'bao 25kg',
        '25kg bag',
        THU_DUC
    ),
    demo(
        'Bánh tráng 22cm',
        'Rice paper 22cm',
        'c-banh',
        'cây 44 cái',
        'pack of 44',
        HOC_MON
    ),
    demo(
        'Bún tươi sợi nhỏ',
        'Fresh rice vermicelli',
        'c-banh',
        'kg',
        'kg',
        HOC_MON
    ),

    // Đồ uống
    demo(
        'Cà phê rang xay Robusta',
        'Robusta ground coffee',
        'c-douong',
        'kg',
        'kg',
        THU_DUC
    ),
    demo(
        'Trà ô long túi lọc',
        'Oolong tea bags',
        'c-douong',
        'hộp 100 gói',
        'box of 100',
        THU_DUC
    ),
    demo(
        'Nước suối chai 500ml',
        'Bottled water 500ml',
        'c-douong',
        'thùng 24 chai',
        'case of 24',
        THU_DUC
    ),
    demo(
        'Nước ngọt có gas',
        'Soft drinks',
        'c-douong',
        'thùng 24 lon',
        'case of 24',
        THU_DUC
    ),
    demo(
        'Siro đường mía',
        'Cane sugar syrup',
        'c-douong',
        'chai 1L',
        '1L bottle',
        THU_DUC
    ),
    demo(
        'Nước cốt dừa',
        'Coconut cream',
        'c-douong',
        'thùng 12 lon',
        'case of 12',
        HOC_MON
    ),

    // Gia vị & đồ khô
    demo(
        'Nước mắm nhĩ 40 độ đạm',
        'Premium fish sauce 40N',
        'c-giavi',
        'chai 1L',
        '1L bottle',
        BINH_DIEN
    ),
    demo(
        'Dầu ăn thực vật',
        'Vegetable cooking oil',
        'c-giavi',
        'can 25L',
        '25L can',
        THU_DUC
    ),
    demo('Gạo ST25', 'ST25 rice', 'c-giavi', 'bao 50kg', '50kg bag', HOC_MON),
    demo(
        'Đường cát trắng',
        'White sugar',
        'c-giavi',
        'bao 50kg',
        '50kg bag',
        THU_DUC
    ),
    demo(
        'Muối hạt sạch',
        'Coarse sea salt',
        'c-giavi',
        'bao 25kg',
        '25kg bag',
        BINH_DIEN
    ),
    demo(
        'Tiêu đen Phú Quốc',
        'Phu Quoc black pepper',
        'c-giavi',
        'kg',
        'kg',
        BINH_DIEN
    ),
];
