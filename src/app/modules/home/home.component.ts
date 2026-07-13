import { NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

interface Category {
    name: string;
    emoji: string;
    bg: string;
}

interface Product {
    name: string;
    vendor: string;
    emoji: string;
    bg: string;
    price: number;
    oldPrice?: number;
    rating: number;
    badge?: string;
    badgeClass?: string;
}

interface Promo {
    title: string;
    cta: string;
    emoji: string;
    gradient: string;
}

interface BlogPost {
    title: string;
    excerpt: string;
    emoji: string;
    bg: string;
    date: string;
}

interface Feature {
    icon: string;
    title: string;
    text: string;
}

@Component({
    selector: 'home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatButtonModule, RouterLink, MatIconModule, NgClass],
})
export class HomeComponent implements OnInit, OnDestroy {
    readonly categories: Category[] = [
        { name: 'Rau củ', emoji: '🥦', bg: '#eaf7ef' },
        { name: 'Trái cây tươi', emoji: '🍎', bg: '#fdeef0' },
        { name: 'Thịt', emoji: '🥩', bg: '#fbeceb' },
        { name: 'Hải sản', emoji: '🦐', bg: '#eaf3fb' },
        { name: 'Trứng', emoji: '🥚', bg: '#fdf6e7' },
        { name: 'Bánh mì & bánh ngọt', emoji: '🥖', bg: '#f7efe6' },
        { name: 'Đồ uống', emoji: '🥤', bg: '#eef0fb' },
        { name: 'Ăn vặt', emoji: '🍿', bg: '#f4eefb' },
    ];

    readonly popularProducts: Product[] = [
        {
            name: 'Chanh hữu cơ',
            vendor: 'NestFood',
            emoji: '🍋',
            bg: '#fdf6e7',
            price: 2.51,
            oldPrice: 3.2,
            rating: 4,
            badge: 'Bán chạy',
            badgeClass: 'home-badge--rose',
        },
        {
            name: 'Bó hành lá',
            vendor: 'NestFood',
            emoji: '🧅',
            bg: '#eaf7ef',
            price: 1.32,
            oldPrice: 1.99,
            rating: 5,
            badge: 'Giảm giá',
            badgeClass: 'home-badge--primary',
        },
        {
            name: 'Ớt đỏ tươi',
            vendor: 'NestFood',
            emoji: '🌶️',
            bg: '#fbeceb',
            price: 0.99,
            rating: 4,
            badge: 'Mới',
            badgeClass: 'home-badge--blue',
        },
        {
            name: 'Lá húng quế',
            vendor: 'NestFood',
            emoji: '🌿',
            bg: '#eaf7ef',
            price: 2.0,
            oldPrice: 2.8,
            rating: 3,
        },
        {
            name: 'Bơ chín',
            vendor: 'NestFood',
            emoji: '🥑',
            bg: '#eef7e9',
            price: 3.45,
            oldPrice: 4.0,
            rating: 5,
            badge: '-14%',
            badgeClass: 'home-badge--amber',
        },
    ];

    readonly saleProducts: Product[] = [
        {
            name: 'Bạc hà vườn',
            vendor: 'NestFood',
            emoji: '🌱',
            bg: '#eaf7ef',
            price: 1.25,
            oldPrice: 1.8,
            rating: 4,
            badge: 'Giảm giá',
            badgeClass: 'home-badge--primary',
        },
        {
            name: 'Thịt bò cao cấp',
            vendor: 'Stardust',
            emoji: '🥩',
            bg: '#fbeceb',
            price: 9.3,
            oldPrice: 12.0,
            rating: 5,
            badge: 'Bán chạy',
            badgeClass: 'home-badge--rose',
        },
        {
            name: 'Gà thả vườn',
            vendor: 'NestFood',
            emoji: '🍗',
            bg: '#fdf2e7',
            price: 6.7,
            oldPrice: 8.0,
            rating: 4,
        },
        {
            name: 'Phi lê cá hồi tươi',
            vendor: 'Ocean Co',
            emoji: '🐟',
            bg: '#eaf3fb',
            price: 11.9,
            oldPrice: 14.5,
            rating: 5,
            badge: 'Mới',
            badgeClass: 'home-badge--blue',
        },
        {
            name: 'Nấm sò',
            vendor: 'NestFood',
            emoji: '🍄',
            bg: '#f7efe6',
            price: 3.2,
            rating: 4,
        },
        {
            name: 'Bánh mì baguette thủ công',
            vendor: 'BakeHouse',
            emoji: '🥖',
            bg: '#f7efe6',
            price: 2.1,
            oldPrice: 2.6,
            rating: 4,
            badge: '-19%',
            badgeClass: 'home-badge--amber',
        },
        {
            name: 'Táo xanh giòn',
            vendor: 'NestFood',
            emoji: '🍏',
            bg: '#eef7e9',
            price: 2.85,
            oldPrice: 3.5,
            rating: 5,
        },
        {
            name: 'Sữa tươi 1L',
            vendor: 'DairyLand',
            emoji: '🥛',
            bg: '#eef0fb',
            price: 1.45,
            rating: 4,
            badge: 'Bán chạy',
            badgeClass: 'home-badge--rose',
        },
        {
            name: 'Chậu húng quế',
            vendor: 'NestFood',
            emoji: '🪴',
            bg: '#eaf7ef',
            price: 2.0,
            oldPrice: 2.7,
            rating: 3,
        },
        {
            name: 'Kiwi vàng',
            vendor: 'NestFood',
            emoji: '🥝',
            bg: '#eef7e9',
            price: 3.9,
            oldPrice: 4.6,
            rating: 5,
            badge: 'Giảm giá',
            badgeClass: 'home-badge--primary',
        },
    ];

    readonly promos: Promo[] = [
        {
            title: 'Phô mai thơm ngon từ các trang trại chọn lọc',
            cta: 'Mua ngay',
            emoji: '🧀',
            gradient: 'linear-gradient(135deg, #d7efce 0%, #b6e3a7 100%)',
        },
        {
            title: 'Trái cây tươi mỗi ngày từ Nam Phi',
            cta: 'Mua ngay',
            emoji: '🍇',
            gradient: 'linear-gradient(135deg, #cfe8f6 0%, #aacdec 100%)',
        },
        {
            title: 'Bít tết thơm ngon từ đầu bếp hàng đầu',
            cta: 'Mua ngay',
            emoji: '🥩',
            gradient: 'linear-gradient(135deg, #f3e2c7 0%, #e8c79b 100%)',
        },
    ];

    readonly blogPosts: BlogPost[] = [
        {
            title: 'Lợi ích khi ăn rau củ theo mùa',
            excerpt:
                'Tìm hiểu vì sao mua theo mùa giúp bữa ăn luôn tươi ngon hơn.',
            emoji: '🥬',
            bg: '#eaf7ef',
            date: '02/06/2026',
        },
        {
            title: 'Cách bảo quản trái cây để giữ độ tươi',
            excerpt: 'Mẹo đơn giản giúp thực phẩm bền lâu hơn.',
            emoji: '🍓',
            bg: '#fdeef0',
            date: '28/05/2026',
        },
        {
            title: '5 bữa tối nhanh & lành mạnh trong tuần',
            excerpt: 'Công thức dinh dưỡng nấu xong trong dưới 30 phút.',
            emoji: '🍲',
            bg: '#fdf2e7',
            date: '21/05/2026',
        },
        {
            title: 'Hướng dẫn chọn dầu olive chất lượng',
            excerpt: 'Những điều cần biết trước khi đặt hàng lần tới.',
            emoji: '🫒',
            bg: '#eef7e9',
            date: '14/05/2026',
        },
    ];

    readonly features: Feature[] = [
        {
            icon: 'heroicons_outline:truck',
            title: 'Giao hàng miễn phí',
            text: 'Cho đơn hàng từ 1,2 triệu đồng',
        },
        {
            icon: 'heroicons_outline:arrow-path',
            title: 'Đổi trả 90 ngày',
            text: 'Nếu hàng hóa có vấn đề',
        },
        {
            icon: 'heroicons_outline:lifebuoy',
            title: 'Thanh toán an toàn',
            text: 'Bảo mật thanh toán 100%',
        },
        {
            icon: 'heroicons_outline:chat-bubble-left-right',
            title: 'Hỗ trợ 24/7',
            text: 'Đội ngũ hỗ trợ tận tình',
        },
    ];

    days = '00';
    hours = '00';
    mins = '00';
    secs = '00';

    private _timerId: ReturnType<typeof setInterval> | null = null;
    private readonly _saleEnd =
        Date.now() + 4 * 24 * 3600 * 1000 + 15600 * 1000;

    constructor(private _cdr: ChangeDetectorRef) {}

    ngOnInit(): void {
        this._tick();
        this._timerId = setInterval(() => this._tick(), 1000);
    }

    ngOnDestroy(): void {
        if (this._timerId) {
            clearInterval(this._timerId);
        }
    }

    stars(rating: number): boolean[] {
        return [1, 2, 3, 4, 5].map((i) => i <= Math.round(rating));
    }

    trackByIndex(index: number): number {
        return index;
    }

    private _tick(): void {
        const diff = Math.max(0, this._saleEnd - Date.now());
        const totalSec = Math.floor(diff / 1000);
        const d = Math.floor(totalSec / 86400);
        const h = Math.floor((totalSec % 86400) / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        this.days = this._pad(d);
        this.hours = this._pad(h);
        this.mins = this._pad(m);
        this.secs = this._pad(s);
        this._cdr.markForCheck();
    }

    private _pad(n: number): string {
        return n < 10 ? `0${n}` : `${n}`;
    }
}
