import {
    CatalogCategory,
    CatalogProduct,
} from 'app/modules/catalog/catalog.types';

export const categories: CatalogCategory[] = [
    {
        id: 'cat-vegetables',
        name: 'Rau củ',
        nameEn: 'Vegetables',
        slug: 'rau-cu',
        icon: 'heroicons_outline:leaf',
    },
    {
        id: 'cat-fruits',
        name: 'Trái cây',
        nameEn: 'Fruits',
        slug: 'trai-cay',
        icon: 'heroicons_outline:sun',
    },
    {
        id: 'cat-meat',
        name: 'Thịt',
        nameEn: 'Meat',
        slug: 'thit',
        icon: 'heroicons_outline:fire',
    },
    {
        id: 'cat-seafood',
        name: 'Hải sản',
        nameEn: 'Seafood',
        slug: 'hai-san',
        icon: 'heroicons_outline:globe-alt',
    },
    {
        id: 'cat-spices',
        name: 'Gia vị',
        nameEn: 'Spices & Condiments',
        slug: 'gia-vi',
        icon: 'heroicons_outline:beaker',
    },
    {
        id: 'cat-eggs-dairy',
        name: 'Trứng & Sữa',
        nameEn: 'Eggs & Dairy',
        slug: 'trung-sua',
        icon: 'heroicons_outline:cube',
    },
];

export const products: CatalogProduct[] = [
    // ── Vegetables ──
    {
        id: 'prod-001',
        name: 'Cà chua',
        nameEn: 'Tomato',
        description:
            'Cà chua tươi, chắc quả, thích hợp nấu canh, xào hoặc làm sốt.',
        descriptionEn:
            'Fresh firm tomatoes, perfect for soups, stir-fry or making sauces.',
        categoryId: 'cat-vegetables',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Hóc Môn',
        thumbnail: 'https://picsum.photos/seed/tomato/400/300',
        images: ['https://picsum.photos/seed/tomato/800/600'],
        active: true,
    },
    {
        id: 'prod-002',
        name: 'Rau muống',
        nameEn: 'Morning Glory',
        description:
            'Rau muống xanh non, giòn ngọt, phổ biến trong ẩm thực Việt Nam.',
        descriptionEn:
            'Fresh tender morning glory, crisp and popular in Vietnamese cuisine.',
        categoryId: 'cat-vegetables',
        unit: 'bó',
        unitEn: 'bunch',
        marketSource: 'Chợ Thủ Đức',
        thumbnail: 'https://picsum.photos/seed/morningglory/400/300',
        images: ['https://picsum.photos/seed/morningglory/800/600'],
        active: true,
    },
    {
        id: 'prod-003',
        name: 'Bắp cải',
        nameEn: 'Cabbage',
        description:
            'Bắp cải xanh tươi, lá dày, thích hợp luộc, xào hoặc muối dưa.',
        descriptionEn:
            'Fresh green cabbage with thick leaves, great for boiling, stir-fry or pickling.',
        categoryId: 'cat-vegetables',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Bình Điền',
        thumbnail: 'https://picsum.photos/seed/cabbage/400/300',
        images: ['https://picsum.photos/seed/cabbage/800/600'],
        active: true,
    },
    {
        id: 'prod-004',
        name: 'Cà rốt',
        nameEn: 'Carrot',
        description:
            'Cà rốt Đà Lạt tươi, ngọt tự nhiên, dùng nấu canh, ép nước hoặc xào.',
        descriptionEn:
            'Fresh Da Lat carrots, naturally sweet, for soups, juicing or stir-fry.',
        categoryId: 'cat-vegetables',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Hóc Môn',
        thumbnail: 'https://picsum.photos/seed/carrot/400/300',
        images: ['https://picsum.photos/seed/carrot/800/600'],
        active: true,
    },
    // ── Fruits ──
    {
        id: 'prod-005',
        name: 'Chuối già',
        nameEn: 'Cavendish Banana',
        description:
            'Chuối già Nam Mỹ, quả to, ngọt dịu, ăn trực tiếp hoặc làm sinh tố.',
        descriptionEn:
            'Large Cavendish bananas, mildly sweet, great fresh or in smoothies.',
        categoryId: 'cat-fruits',
        unit: 'nải',
        unitEn: 'bunch',
        marketSource: 'Chợ Thủ Đức',
        thumbnail: 'https://picsum.photos/seed/banana/400/300',
        images: ['https://picsum.photos/seed/banana/800/600'],
        active: true,
    },
    {
        id: 'prod-006',
        name: 'Xoài cát Hòa Lộc',
        nameEn: 'Hoa Loc Mango',
        description:
            'Xoài cát Hòa Lộc thơm ngọt đặc trưng, thịt vàng mịn không xơ.',
        descriptionEn:
            'Premium Hoa Loc mango with distinctive aroma, smooth yellow flesh.',
        categoryId: 'cat-fruits',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Bình Điền',
        thumbnail: 'https://picsum.photos/seed/mango/400/300',
        images: ['https://picsum.photos/seed/mango/800/600'],
        active: true,
    },
    {
        id: 'prod-007',
        name: 'Thanh long ruột đỏ',
        nameEn: 'Red Dragon Fruit',
        description: 'Thanh long ruột đỏ Bình Thuận, ngọt mát, giàu vitamin C.',
        descriptionEn:
            'Red-fleshed dragon fruit from Binh Thuan, sweet and rich in vitamin C.',
        categoryId: 'cat-fruits',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Hóc Môn',
        thumbnail: 'https://picsum.photos/seed/dragonfruit/400/300',
        images: ['https://picsum.photos/seed/dragonfruit/800/600'],
        active: true,
    },
    {
        id: 'prod-008',
        name: 'Dưa hấu',
        nameEn: 'Watermelon',
        description: 'Dưa hấu ruột đỏ, vỏ mỏng, ngọt mát, thích hợp giải khát.',
        descriptionEn:
            'Red-fleshed watermelon with thin rind, sweet and refreshing.',
        categoryId: 'cat-fruits',
        unit: 'trái',
        unitEn: 'piece',
        marketSource: 'Chợ Thủ Đức',
        thumbnail: 'https://picsum.photos/seed/watermelon/400/300',
        images: ['https://picsum.photos/seed/watermelon/800/600'],
        active: true,
    },
    // ── Meat ──
    {
        id: 'prod-009',
        name: 'Thịt heo ba rọi',
        nameEn: 'Pork Belly',
        description:
            'Thịt heo ba rọi tươi, xen kẽ nạc mỡ, thích hợp kho, nướng.',
        descriptionEn:
            'Fresh pork belly with alternating lean and fat layers, for braising or grilling.',
        categoryId: 'cat-meat',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Bình Điền',
        thumbnail: 'https://picsum.photos/seed/porkbelly/400/300',
        images: ['https://picsum.photos/seed/porkbelly/800/600'],
        active: true,
    },
    {
        id: 'prod-010',
        name: 'Thịt bò thăn nội',
        nameEn: 'Beef Tenderloin',
        description:
            'Thịt bò thăn nội nhập khẩu, mềm, ít mỡ, thích hợp nướng hoặc áp chảo.',
        descriptionEn:
            'Imported beef tenderloin, tender and lean, ideal for grilling or pan-searing.',
        categoryId: 'cat-meat',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Bình Điền',
        thumbnail: 'https://picsum.photos/seed/beeftenderloin/400/300',
        images: ['https://picsum.photos/seed/beeftenderloin/800/600'],
        active: true,
    },
    {
        id: 'prod-011',
        name: 'Đùi gà ta',
        nameEn: 'Free-range Chicken Thigh',
        description:
            'Đùi gà ta thả vườn, thịt chắc, da giòn, thơm ngon tự nhiên.',
        descriptionEn:
            'Free-range chicken thighs, firm meat with crispy skin and natural flavor.',
        categoryId: 'cat-meat',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Hóc Môn',
        thumbnail: 'https://picsum.photos/seed/chickenthigh/400/300',
        images: ['https://picsum.photos/seed/chickenthigh/800/600'],
        active: true,
    },
    {
        id: 'prod-012',
        name: 'Sườn heo non',
        nameEn: 'Pork Spare Ribs',
        description:
            'Sườn heo non tươi, nhiều thịt bám, thích hợp nướng, chiên hoặc kho.',
        descriptionEn:
            'Fresh pork spare ribs with good meat coverage, for grilling, frying or braising.',
        categoryId: 'cat-meat',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Bình Điền',
        thumbnail: 'https://picsum.photos/seed/spareribs/400/300',
        images: ['https://picsum.photos/seed/spareribs/800/600'],
        active: true,
    },
    // ── Seafood ──
    {
        id: 'prod-013',
        name: 'Tôm sú',
        nameEn: 'Tiger Shrimp',
        description:
            'Tôm sú tươi sống, vỏ cứng, thịt chắc ngọt, từ vùng nuôi sạch.',
        descriptionEn:
            'Live tiger shrimp, hard shell with firm sweet flesh, from clean farms.',
        categoryId: 'cat-seafood',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Bình Điền',
        thumbnail: 'https://picsum.photos/seed/tigershrimp/400/300',
        images: ['https://picsum.photos/seed/tigershrimp/800/600'],
        active: true,
    },
    {
        id: 'prod-014',
        name: 'Cá hồi phi lê',
        nameEn: 'Salmon Fillet',
        description:
            'Cá hồi Na Uy phi lê tươi, giàu omega-3, thích hợp nướng hoặc sashimi.',
        descriptionEn:
            'Fresh Norwegian salmon fillet, rich in omega-3, for grilling or sashimi.',
        categoryId: 'cat-seafood',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Bình Điền',
        thumbnail: 'https://picsum.photos/seed/salmon/400/300',
        images: ['https://picsum.photos/seed/salmon/800/600'],
        active: true,
    },
    {
        id: 'prod-015',
        name: 'Mực ống',
        nameEn: 'Squid',
        description:
            'Mực ống tươi, thân trắng trong, thích hợp nướng, xào hoặc nhồi thịt.',
        descriptionEn:
            'Fresh squid with translucent body, for grilling, stir-fry or stuffing.',
        categoryId: 'cat-seafood',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Bình Điền',
        thumbnail: 'https://picsum.photos/seed/squid/400/300',
        images: ['https://picsum.photos/seed/squid/800/600'],
        active: true,
    },
    {
        id: 'prod-016',
        name: 'Nghêu trắng',
        nameEn: 'White Clam',
        description:
            'Nghêu trắng tươi sống, vỏ sáng, thịt ngọt béo, hấp hoặc nấu canh.',
        descriptionEn:
            'Live white clams with bright shells and sweet fatty flesh, for steaming or soups.',
        categoryId: 'cat-seafood',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Thủ Đức',
        thumbnail: 'https://picsum.photos/seed/clam/400/300',
        images: ['https://picsum.photos/seed/clam/800/600'],
        active: true,
    },
    // ── Spices ──
    {
        id: 'prod-017',
        name: 'Tỏi Lý Sơn',
        nameEn: 'Ly Son Garlic',
        description:
            'Tỏi Lý Sơn chính hiệu, củ nhỏ, thơm nồng, vị cay đặc trưng.',
        descriptionEn:
            'Authentic Ly Son garlic, small bulbs with intense aroma and distinctive spiciness.',
        categoryId: 'cat-spices',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Hóc Môn',
        thumbnail: 'https://picsum.photos/seed/garlic/400/300',
        images: ['https://picsum.photos/seed/garlic/800/600'],
        active: true,
    },
    {
        id: 'prod-018',
        name: 'Ớt hiểm',
        nameEn: 'Horn Chili',
        description:
            'Ớt hiểm tươi, cay vừa phải, dùng nấu ăn hoặc làm tương ớt.',
        descriptionEn:
            'Fresh horn chili, moderately spicy, for cooking or making chili sauce.',
        categoryId: 'cat-spices',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Thủ Đức',
        thumbnail: 'https://picsum.photos/seed/chili/400/300',
        images: ['https://picsum.photos/seed/chili/800/600'],
        active: true,
    },
    {
        id: 'prod-019',
        name: 'Sả',
        nameEn: 'Lemongrass',
        description:
            'Sả tươi thơm, dùng ướp thịt, nấu lẩu, pha trà hoặc làm tinh dầu.',
        descriptionEn:
            'Fresh fragrant lemongrass, for marinating, hotpot, tea or essential oils.',
        categoryId: 'cat-spices',
        unit: 'bó',
        unitEn: 'bunch',
        marketSource: 'Chợ Hóc Môn',
        thumbnail: 'https://picsum.photos/seed/lemongrass/400/300',
        images: ['https://picsum.photos/seed/lemongrass/800/600'],
        active: true,
    },
    {
        id: 'prod-020',
        name: 'Gừng',
        nameEn: 'Ginger',
        description:
            'Gừng ta tươi, vị cay nồng, dùng gia vị nấu ăn hoặc pha trà.',
        descriptionEn:
            'Fresh local ginger with strong spicy flavor, for cooking or making tea.',
        categoryId: 'cat-spices',
        unit: 'kg',
        unitEn: 'kg',
        marketSource: 'Chợ Thủ Đức',
        thumbnail: 'https://picsum.photos/seed/ginger/400/300',
        images: ['https://picsum.photos/seed/ginger/800/600'],
        active: true,
    },
    // ── Eggs & Dairy ──
    {
        id: 'prod-021',
        name: 'Trứng gà ta',
        nameEn: 'Free-range Chicken Egg',
        description: 'Trứng gà ta thả vườn, lòng đỏ đậm, giàu dinh dưỡng.',
        descriptionEn:
            'Free-range chicken eggs with deep yellow yolks, rich in nutrition.',
        categoryId: 'cat-eggs-dairy',
        unit: 'vỉ 10 trứng',
        unitEn: 'tray of 10',
        marketSource: 'Chợ Hóc Môn',
        thumbnail: 'https://picsum.photos/seed/eggs/400/300',
        images: ['https://picsum.photos/seed/eggs/800/600'],
        active: true,
    },
    {
        id: 'prod-022',
        name: 'Sữa tươi Mộc Châu',
        nameEn: 'Moc Chau Fresh Milk',
        description:
            'Sữa tươi thanh trùng Mộc Châu, béo ngậy, không đường, thùng 12 hộp.',
        descriptionEn:
            'Moc Chau pasteurized fresh milk, creamy, unsweetened, box of 12.',
        categoryId: 'cat-eggs-dairy',
        unit: 'thùng',
        unitEn: 'box',
        marketSource: 'Chợ Bình Điền',
        thumbnail: 'https://picsum.photos/seed/milk/400/300',
        images: ['https://picsum.photos/seed/milk/800/600'],
        active: true,
    },
    {
        id: 'prod-023',
        name: 'Bơ lạt Anchor',
        nameEn: 'Anchor Unsalted Butter',
        description:
            'Bơ lạt Anchor nhập khẩu New Zealand, dùng nấu ăn và làm bánh.',
        descriptionEn:
            'Anchor unsalted butter imported from New Zealand, for cooking and baking.',
        categoryId: 'cat-eggs-dairy',
        unit: 'hộp 227g',
        unitEn: '227g block',
        marketSource: 'Chợ Bình Điền',
        thumbnail: 'https://picsum.photos/seed/butter/400/300',
        images: ['https://picsum.photos/seed/butter/800/600'],
        active: true,
    },
    {
        id: 'prod-024',
        name: 'Trứng vịt muối',
        nameEn: 'Salted Duck Egg',
        description:
            'Trứng vịt muối lòng đào, vỏ xanh, lòng đỏ đỏ cam, béo bùi.',
        descriptionEn:
            'Salted duck eggs with runny yolk, green shell and rich orange-red yolk.',
        categoryId: 'cat-eggs-dairy',
        unit: 'vỉ 4 trứng',
        unitEn: 'tray of 4',
        marketSource: 'Chợ Hóc Môn',
        thumbnail: 'https://picsum.photos/seed/saltedegg/400/300',
        images: ['https://picsum.photos/seed/saltedegg/800/600'],
        active: true,
    },
];
