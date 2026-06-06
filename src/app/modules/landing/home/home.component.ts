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
    selector: 'landing-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatButtonModule, RouterLink, MatIconModule, NgClass],
})
export class LandingHomeComponent implements OnInit, OnDestroy {
    readonly categories: Category[] = [
        { name: 'Vegetables', emoji: '🥦', bg: '#eaf7ef' },
        { name: 'Fresh Fruit', emoji: '🍎', bg: '#fdeef0' },
        { name: 'Meat', emoji: '🥩', bg: '#fbeceb' },
        { name: 'Seafood', emoji: '🦐', bg: '#eaf3fb' },
        { name: 'Eggs', emoji: '🥚', bg: '#fdf6e7' },
        { name: 'Bakery', emoji: '🥖', bg: '#f7efe6' },
        { name: 'Drinks', emoji: '🥤', bg: '#eef0fb' },
        { name: 'Snacks', emoji: '🍿', bg: '#f4eefb' },
    ];

    readonly popularProducts: Product[] = [
        {
            name: 'Organic Lemons',
            vendor: 'NestFood',
            emoji: '🍋',
            bg: '#fdf6e7',
            price: 2.51,
            oldPrice: 3.2,
            rating: 4,
            badge: 'Hot',
            badgeClass: 'home-badge--rose',
        },
        {
            name: 'Spring Onion Bunch',
            vendor: 'NestFood',
            emoji: '🧅',
            bg: '#eaf7ef',
            price: 1.32,
            oldPrice: 1.99,
            rating: 5,
            badge: 'Sale',
            badgeClass: 'home-badge--primary',
        },
        {
            name: 'Fresh Red Chilli',
            vendor: 'NestFood',
            emoji: '🌶️',
            bg: '#fbeceb',
            price: 0.99,
            rating: 4,
            badge: 'New',
            badgeClass: 'home-badge--blue',
        },
        {
            name: 'Basil Leaves',
            vendor: 'NestFood',
            emoji: '🌿',
            bg: '#eaf7ef',
            price: 2.0,
            oldPrice: 2.8,
            rating: 3,
        },
        {
            name: 'Ripe Avocados',
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
            name: 'Garden Mint',
            vendor: 'NestFood',
            emoji: '🌱',
            bg: '#eaf7ef',
            price: 1.25,
            oldPrice: 1.8,
            rating: 4,
            badge: 'Sale',
            badgeClass: 'home-badge--primary',
        },
        {
            name: 'Prime Beef Cut',
            vendor: 'Stardust',
            emoji: '🥩',
            bg: '#fbeceb',
            price: 9.3,
            oldPrice: 12.0,
            rating: 5,
            badge: 'Hot',
            badgeClass: 'home-badge--rose',
        },
        {
            name: 'Free-range Chicken',
            vendor: 'NestFood',
            emoji: '🍗',
            bg: '#fdf2e7',
            price: 6.7,
            oldPrice: 8.0,
            rating: 4,
        },
        {
            name: 'Fresh Salmon Fillet',
            vendor: 'Ocean Co',
            emoji: '🐟',
            bg: '#eaf3fb',
            price: 11.9,
            oldPrice: 14.5,
            rating: 5,
            badge: 'New',
            badgeClass: 'home-badge--blue',
        },
        {
            name: 'Oyster Mushrooms',
            vendor: 'NestFood',
            emoji: '🍄',
            bg: '#f7efe6',
            price: 3.2,
            rating: 4,
        },
        {
            name: 'Artisan Baguette',
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
            name: 'Crisp Green Apples',
            vendor: 'NestFood',
            emoji: '🍏',
            bg: '#eef7e9',
            price: 2.85,
            oldPrice: 3.5,
            rating: 5,
        },
        {
            name: 'Fresh Milk 1L',
            vendor: 'DairyLand',
            emoji: '🥛',
            bg: '#eef0fb',
            price: 1.45,
            rating: 4,
            badge: 'Hot',
            badgeClass: 'home-badge--rose',
        },
        {
            name: 'Sweet Basil Pot',
            vendor: 'NestFood',
            emoji: '🪴',
            bg: '#eaf7ef',
            price: 2.0,
            oldPrice: 2.7,
            rating: 3,
        },
        {
            name: 'Golden Kiwi',
            vendor: 'NestFood',
            emoji: '🥝',
            bg: '#eef7e9',
            price: 3.9,
            oldPrice: 4.6,
            rating: 5,
            badge: 'Sale',
            badgeClass: 'home-badge--primary',
        },
    ];

    readonly promos: Promo[] = [
        {
            title: 'Delicious Cheese from Selected Farms',
            cta: 'Shop Now',
            emoji: '🧀',
            gradient: 'linear-gradient(135deg, #d7efce 0%, #b6e3a7 100%)',
        },
        {
            title: 'Everyday Fresh Fruits from South Africa',
            cta: 'Shop Now',
            emoji: '🍇',
            gradient: 'linear-gradient(135deg, #cfe8f6 0%, #aacdec 100%)',
        },
        {
            title: 'Tasty Steaks from Our Best Chef',
            cta: 'Shop Now',
            emoji: '🥩',
            gradient: 'linear-gradient(135deg, #f3e2c7 0%, #e8c79b 100%)',
        },
    ];

    readonly blogPosts: BlogPost[] = [
        {
            title: 'The Benefits of Eating Seasonal Produce',
            excerpt: 'Discover why shopping seasonal keeps your meals fresher.',
            emoji: '🥬',
            bg: '#eaf7ef',
            date: 'Jun 02, 2026',
        },
        {
            title: 'How to Store Fruits to Keep Them Fresh',
            excerpt: 'Simple tips to make your groceries last much longer.',
            emoji: '🍓',
            bg: '#fdeef0',
            date: 'May 28, 2026',
        },
        {
            title: '5 Quick & Healthy Weeknight Dinners',
            excerpt: 'Wholesome recipes you can cook in under 30 minutes.',
            emoji: '🍲',
            bg: '#fdf2e7',
            date: 'May 21, 2026',
        },
        {
            title: 'A Guide to Choosing the Best Olive Oil',
            excerpt: 'Everything you need to know before your next purchase.',
            emoji: '🫒',
            bg: '#eef7e9',
            date: 'May 14, 2026',
        },
    ];

    readonly features: Feature[] = [
        {
            icon: 'heroicons_outline:truck',
            title: 'Free Delivery',
            text: 'For all orders over $50',
        },
        {
            icon: 'heroicons_outline:arrow-path',
            title: '90 Days Return',
            text: 'If goods have problems',
        },
        {
            icon: 'heroicons_outline:lifebuoy',
            title: 'Secure Payment',
            text: '100% secure payment',
        },
        {
            icon: 'heroicons_outline:chat-bubble-left-right',
            title: '24/7 Support',
            text: 'Dedicated support',
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
