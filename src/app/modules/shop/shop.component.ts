import { NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

export interface ShopProduct {
    id: number;
    name: string;
    vendor: string;
    emoji: string;
    bg: string;
    price: number;
    oldPrice?: number;
    rating: number;
    reviews: number;
    badge?: string;
    badgeClass?: string;
    description: string;
    qty: number;
    available?: number;
    colors?: string[];
}

@Component({
    selector: 'shop-page',
    templateUrl: './shop.component.html',
    styleUrls: ['./shop.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatIconModule, RouterLink, FormsModule, NgClass],
})
export class ShopComponent implements OnInit {
    /* ── Sub-nav category pills ── */
    readonly subNavCategories = [
        { name: 'Tất cả', emoji: '🛒' },
        { name: 'Rau củ', emoji: '🥦' },
        { name: 'Trái cây tươi', emoji: '🍓' },
        { name: 'Thịt', emoji: '🥩' },
        { name: 'Hải sản', emoji: '🦐' },
        { name: 'Trứng', emoji: '🥚' },
        { name: 'Bánh mì & nướng', emoji: '🍞' },
        { name: 'Đồ uống', emoji: '🧃' },
        { name: 'Phô mai', emoji: '🧀' },
        { name: 'Sữa', emoji: '🥛' },
    ];

    activeSubNav = 'Tất cả';

    /* ── Icon category row ── */
    readonly iconCategories = [
        { name: 'Rau củ', emoji: '🥦', bg: '#eaf7ef' },
        { name: 'Trái cây tươi', emoji: '🍎', bg: '#fdeef0' },
        { name: 'Thịt', emoji: '🥩', bg: '#fbeceb' },
        { name: 'Hải sản', emoji: '🦐', bg: '#eaf3fb' },
        { name: 'Trứng', emoji: '🥚', bg: '#fdf6e7' },
        { name: 'Bánh mì & nướng', emoji: '🍞', bg: '#f7efe6' },
        { name: 'Đồ uống', emoji: '🧃', bg: '#eef0fb' },
        { name: 'Phô mai', emoji: '🧀', bg: '#fdfae7' },
        { name: 'Sữa', emoji: '🥛', bg: '#eef0fb' },
    ];

    /* ── Sidebar filter categories ── */
    readonly sidebarCategories = [
        { name: 'Bánh mì & nướng', count: 4 },
        { name: 'Phô mai', count: 6 },
        { name: 'Đồ uống', count: 12 },
        { name: 'Trứng', count: 3 },
        { name: 'Nước ép', count: 5 },
        { name: 'Trái cây tươi', count: 18 },
        { name: 'Thịt', count: 14 },
        { name: 'Hải sản', count: 8 },
        { name: 'Rau củ', count: 22 },
    ];

    selectedCategory = '';
    priceMin = 0;
    priceMax = 120;
    selectedColors: string[] = [];
    selectedSizes: string[] = [];
    selectedRating = 0;

    readonly colorSwatches = [
        '#ef4444',
        '#f97316',
        '#eab308',
        '#22c55e',
        '#3b82f6',
        '#8b5cf6',
        '#ec4899',
        '#78716c',
        '#1c1917',
    ];
    readonly sizeOptions = ['XS', 'S', 'M', 'L', 'XL'];
    readonly weightOptions = ['0.5 kg', '1 kg', '2 kg', '5 kg'];
    readonly countryOptions = [
        { name: 'Pháp', flag: '🇫🇷' },
        { name: 'Đức', flag: '🇩🇪' },
        { name: 'Việt Nam', flag: '🇻🇳' },
        { name: 'Mỹ', flag: '🇺🇸' },
    ];
    readonly unitOptions = ['Cái', 'Bó', 'Gói', 'Kg', 'Hộp'];
    selectedUnit = 'Cái';

    /* ── Sort ── */
    sortBy = 'default';
    readonly sortOptions = [
        { value: 'default', label: 'Sắp xếp mặc định' },
        { value: 'price-asc', label: 'Giá: Thấp đến cao' },
        { value: 'price-desc', label: 'Giá: Cao đến thấp' },
        { value: 'rating', label: 'Đánh giá cao nhất' },
        { value: 'newest', label: 'Mới nhất' },
    ];

    /* ── Products ── */
    readonly allProducts: ShopProduct[] = [
        {
            id: 1,
            name: 'Bó hành lá',
            vendor: 'NestFood',
            emoji: '🧅',
            bg: '#eaf7ef',
            price: 10.0,
            oldPrice: 13.0,
            rating: 4,
            reviews: 35,
            badge: 'Bán chạy',
            badgeClass: 'shop-badge--amber',
            description:
                'Hành lá tươi từ nông trại địa phương, thích hợp xào và làm salad.',
            qty: 1,
        },
        {
            id: 2,
            name: 'Lá húng quế',
            vendor: 'NestFood',
            emoji: '🌿',
            bg: '#eaf7ef',
            price: 8.0,
            oldPrice: 11.0,
            rating: 5,
            reviews: 22,
            badge: 'Mới',
            badgeClass: 'shop-badge--blue',
            description:
                'Húng quế thơm, hoàn hảo cho mì Ý, pizza và sốt pesto.',
            qty: 1,
        },
        {
            id: 3,
            name: 'Cà rốt 1 kg',
            vendor: 'NestFood',
            emoji: '🥕',
            bg: '#fff4e6',
            price: 7.0,
            rating: 4,
            reviews: 41,
            description:
                'Cà rốt ngọt giòn mới thu hoạch. Tuyệt vời để ép nước, nướng hoặc ăn vặt.',
            qty: 1,
        },
        {
            id: 4,
            name: 'Củ cải đỏ 1 gói',
            vendor: 'NestFood',
            emoji: '🌶️',
            bg: '#fdeef0',
            price: 20.0,
            oldPrice: 25.0,
            rating: 5,
            reviews: 18,
            description:
                'Củ cải giòn cay, thêm màu sắc và độ giòn cho mọi món ăn.',
            qty: 1,
        },
        {
            id: 5,
            name: 'Tỏi rừng 500g',
            vendor: 'NestFood',
            emoji: '🧄',
            bg: '#fdf6e7',
            price: 20.0,
            rating: 3,
            reviews: 9,
            description: 'Tỏi rừng đậm vị. Lý tưởng cho súp, sốt và bơ tỏi.',
            qty: 1,
        },
        {
            id: 6,
            name: 'Nấm hạt dẻ 300g',
            vendor: 'NestFood',
            emoji: '🍄',
            bg: '#f7efe6',
            price: 10.0,
            oldPrice: 13.0,
            rating: 4,
            reviews: 30,
            badge: 'Nổi bật',
            badgeClass: 'shop-badge--rose',
            description: 'Nấm hạt dẻ thơm bùi, lý tưởng cho risotto và mì Ý.',
            qty: 1,
        },
        {
            id: 7,
            name: 'Bơ Hass 2 quả',
            vendor: 'NestFood',
            emoji: '🥑',
            bg: '#eef7e9',
            price: 9.0,
            oldPrice: 12.0,
            rating: 5,
            reviews: 54,
            description:
                'Bơ Hass chín mềm béo. Giàu chất béo tốt, hoàn hảo cho guacamole.',
            qty: 1,
            colors: ['#22c55e', '#1c1917', '#eab308'],
        },
        {
            id: 8,
            name: 'Kiwi',
            vendor: 'NestFood',
            emoji: '🥝',
            bg: '#eaf7ef',
            price: 10.0,
            rating: 4,
            reviews: 12,
            description:
                'Kiwi chua ngọt, giàu vitamin C và chất chống oxy hóa.',
            qty: 1,
        },
        {
            id: 9,
            name: 'Dừa tươi 1 quả',
            vendor: 'NestFood',
            emoji: '🥥',
            bg: '#fdf6e7',
            price: 45.0,
            oldPrice: 50.0,
            rating: 4,
            reviews: 27,
            description:
                'Dừa tươi nguyên quả với nước ngọt và cơm trắng mềm bên trong.',
            qty: 1,
            available: 26,
        },
        {
            id: 10,
            name: 'Dâu tây 250g',
            vendor: 'NestFood',
            emoji: '🍓',
            bg: '#fdeef0',
            price: 9.99,
            oldPrice: 12.99,
            rating: 5,
            reviews: 63,
            badge: 'Giảm giá',
            badgeClass: 'shop-badge--primary',
            description: 'Dâu tây chín nắng, ngọt với màu đỏ ruby tươi sáng.',
            qty: 1,
        },
        {
            id: 11,
            name: 'Việt quất 125g',
            vendor: 'NestFood',
            emoji: '🫐',
            bg: '#eef0fb',
            price: 40.0,
            rating: 4,
            reviews: 19,
            description:
                'Việt quất mọng nước, ngọt tự nhiên và giàu chất chống oxy hóa.',
            qty: 1,
        },
        {
            id: 12,
            name: 'Quả lý chua đen',
            vendor: 'NestFood',
            emoji: '🍇',
            bg: '#f5eefb',
            price: 10.0,
            rating: 3,
            reviews: 8,
            description:
                'Lý chua đen đậm vị. Hoàn hảo cho mứt, sốt và sinh tố.',
            qty: 1,
        },
        {
            id: 13,
            name: 'Táo xanh',
            vendor: 'NestFood',
            emoji: '🍏',
            bg: '#eef7e9',
            price: 29.0,
            oldPrice: 33.0,
            rating: 5,
            reviews: 44,
            badge: 'Hữu cơ',
            badgeClass: 'shop-badge--primary',
            description:
                'Táo Granny Smith giòn chua. Tuyệt vời ăn sống, nướng hoặc trong sinh tố xanh.',
            qty: 1,
        },
        {
            id: 14,
            name: 'Nho không hạt',
            vendor: 'NestFood',
            emoji: '🍇',
            bg: '#f5eefb',
            price: 14.0,
            rating: 4,
            reviews: 31,
            description:
                'Nho đỏ không hạt ngọt. Ăn vặt hoặc thêm vào salad và đĩa phô mai.',
            qty: 1,
            colors: ['#ef4444', '#1c1917'],
        },
        {
            id: 15,
            name: 'Bít tết cổ bò Halal 400g',
            vendor: 'NestFood',
            emoji: '🥩',
            bg: '#fbeceb',
            price: 159.0,
            oldPrice: 180.0,
            rating: 4,
            reviews: 21,
            badge: 'Halal',
            badgeClass: 'shop-badge--amber',
            description:
                'Bít tết cổ bò cao cấp, hầm chậm cho vị đậm đà mềm ngon. Chứng nhận Halal.',
            qty: 1,
        },
        {
            id: 16,
            name: 'Halloumi bò lát',
            vendor: 'NestFood',
            emoji: '🧀',
            bg: '#fdfae7',
            price: 177.0,
            rating: 5,
            reviews: 36,
            description:
                'Halloumi vàng với vị mặn thơm ngon. Nướng hoặc chiên đều ngon.',
            qty: 1,
        },
        {
            id: 17,
            name: 'Bò cuộn Sioklun kiểu Philippines',
            vendor: 'NestFood',
            emoji: '🥩',
            bg: '#fbeceb',
            price: 160.0,
            oldPrice: 200.0,
            rating: 4,
            reviews: 14,
            badge: 'Nổi bật',
            badgeClass: 'shop-badge--rose',
            description:
                'Cuộn bò kiểu Philippines ướp sốt đậm đà truyền thống.',
            qty: 1,
            available: 38,
        },
        {
            id: 18,
            name: 'Vịt nguyên con 1,7–2,5 kg',
            vendor: 'NestFood',
            emoji: '🦆',
            bg: '#fdf2e7',
            price: 250.0,
            rating: 4,
            reviews: 11,
            description:
                'Vịt thả vườn nguyên con, thịt đậm vị, hoàn hảo để quay.',
            qty: 1,
        },
        {
            id: 19,
            name: 'Thịt gà xay ức',
            vendor: 'NestFood',
            emoji: '🍗',
            bg: '#fdf6e7',
            price: 71.0,
            oldPrice: 90.0,
            rating: 5,
            reviews: 48,
            description:
                'Thịt gà ức nạc xay. Lý tưởng cho burger, thịt viên và bữa ăn lành mạnh.',
            qty: 1,
        },
        {
            id: 20,
            name: 'Bồ câu nguyên con đông lạnh',
            vendor: 'NestFood',
            emoji: '🐦',
            bg: '#eef0fb',
            price: 145.0,
            oldPrice: 160.0,
            rating: 4,
            reviews: 7,
            description:
                'Bồ câu nguyên con đông lạnh, mềm đậm vị để om hoặc hầm chậm.',
            qty: 1,
        },
        {
            id: 21,
            name: 'Hộp thịt cừu Scotland cao cấp',
            vendor: 'NestFood',
            emoji: '🥩',
            bg: '#fbeceb',
            price: 99.0,
            oldPrice: 115.0,
            rating: 5,
            reviews: 23,
            badge: 'Bán chạy',
            badgeClass: 'shop-badge--amber',
            description:
                'Các phần thịt cừu Scotland cao cấp trong hộp tuyển chọn, trực tiếp từ trang trại.',
            qty: 1,
        },
        {
            id: 22,
            name: 'Thịt heo không xương sốt cam nho khô',
            vendor: 'NestFood',
            emoji: '🍖',
            bg: '#fdf2e7',
            price: 99.0,
            rating: 3,
            reviews: 5,
            description:
                'Thịt heo không xương phủ sốt cam ngọt với nho khô mọng nước.',
            qty: 1,
        },
        {
            id: 23,
            name: 'Bít tết Black Cotton',
            vendor: 'NestFood',
            emoji: '🥩',
            bg: '#fbeceb',
            price: 160.0,
            oldPrice: 190.0,
            rating: 4,
            reviews: 17,
            description:
                'Bít tết Black Cotton ủ khô với vị bò đậm đà và mỡ vân đẹp.',
            qty: 1,
        },
        {
            id: 24,
            name: 'Cá hồi hun khói lạnh 400g',
            vendor: 'OceanCo',
            emoji: '🐟',
            bg: '#eaf3fb',
            price: 60.0,
            oldPrice: 75.0,
            rating: 5,
            reviews: 52,
            badge: 'Mới',
            badgeClass: 'shop-badge--blue',
            description:
                'Cá hồi Na Uy hun khói lạnh mềm mại, vị hun nhẹ. Đã cắt sẵn.',
            qty: 1,
        },
        {
            id: 25,
            name: 'Cá sen nguyên con tươi',
            vendor: 'OceanCo',
            emoji: '🐠',
            bg: '#eaf3fb',
            price: 44.0,
            rating: 4,
            reviews: 20,
            description:
                'Cá sen tươi nguyên con nguồn gốc bền vững. Thịt trắng mềm, xốp.',
            qty: 1,
        },
        {
            id: 26,
            name: 'Tôm vua jumbo 6 con',
            vendor: 'OceanCo',
            emoji: '🦐',
            bg: '#eaf3fb',
            price: 400.0,
            oldPrice: 450.0,
            rating: 5,
            reviews: 39,
            badge: 'Nổi bật',
            badgeClass: 'shop-badge--rose',
            description:
                'Tôm vua size XL, hoàn hảo nướng, xào hoặc cocktail tôm cổ điển.',
            qty: 1,
        },
        {
            id: 27,
            name: 'Tôm vua đã bóc vỏ',
            vendor: 'OceanCo',
            emoji: '🦐',
            bg: '#eaf3fb',
            price: 60.0,
            rating: 4,
            reviews: 28,
            description:
                'Tôm vua đã bóc vỏ, sẵn sàng nấu. Tiết kiệm thời gian cho bữa tối trong tuần.',
            qty: 1,
        },
        {
            id: 28,
            name: 'Tôm hỗn hợp Halvar',
            vendor: 'OceanCo',
            emoji: '🦞',
            bg: '#eaf3fb',
            price: 30.0,
            oldPrice: 40.0,
            rating: 3,
            reviews: 10,
            description:
                'Tuyển chọn tôm Đại Tây Dương và tôm hùm trong một phần.',
            qty: 1,
        },
    ];

    filteredProducts: ShopProduct[] = [];
    currentPage = 1;
    pageSize = 12;
    totalProducts = 0;

    constructor(private _cdr: ChangeDetectorRef) {}

    ngOnInit(): void {
        this._applyFilters();
    }

    get totalPages(): number {
        return Math.ceil(this.totalProducts / this.pageSize);
    }

    get pages(): number[] {
        return Array.from({ length: this.totalPages }, (_, i) => i + 1);
    }

    get pagedProducts(): ShopProduct[] {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.filteredProducts.slice(start, start + this.pageSize);
    }

    get showingFrom(): number {
        return (this.currentPage - 1) * this.pageSize + 1;
    }

    get showingTo(): number {
        return Math.min(this.currentPage * this.pageSize, this.totalProducts);
    }

    stars(rating: number): boolean[] {
        return [1, 2, 3, 4, 5].map((i) => i <= Math.round(rating));
    }

    selectSubNav(name: string): void {
        this.activeSubNav = name;
        this.selectedCategory = name === 'Tất cả' ? '' : name;
        this.currentPage = 1;
        this._applyFilters();
    }

    selectCategory(name: string): void {
        this.selectedCategory = this.selectedCategory === name ? '' : name;
        this.currentPage = 1;
        this._applyFilters();
    }

    goToPage(p: number): void {
        if (p >= 1 && p <= this.totalPages) {
            this.currentPage = p;
        }
    }

    applyFilter(): void {
        this.currentPage = 1;
        this._applyFilters();
    }

    toggleColor(c: string): void {
        const i = this.selectedColors.indexOf(c);
        if (i >= 0) this.selectedColors.splice(i, 1);
        else this.selectedColors.push(c);
    }

    private _applyFilters(): void {
        let products = [...this.allProducts];
        if (this.selectedCategory && this.selectedCategory !== 'Tất cả') {
            const map: Record<string, string[]> = {
                'Rau củ': ['🥦', '🥕', '🧄', '🥬', '🧅', '🌶️', '🌿'],
                'Trái cây tươi': ['🍎', '🍓', '🥝', '🍏', '🫐', '🍇', '🥥'],
                Thịt: ['🥩', '🍗', '🍖', '🦆', '🐦'],
                'Hải sản': ['🦐', '🐟', '🐠', '🦞'],
                Trứng: ['🥚'],
                'Bánh mì & nướng': ['🍞', '🥖'],
                'Đồ uống': ['🧃', '🥤'],
                'Phô mai': ['🧀'],
                Sữa: ['🥛'],
            };
            const emojis = map[this.selectedCategory] || [];
            if (emojis.length) {
                products = products.filter((p) => emojis.includes(p.emoji));
            }
        }
        this.totalProducts = products.length;
        this.filteredProducts = products;
        this._cdr.markForCheck();
    }
}
