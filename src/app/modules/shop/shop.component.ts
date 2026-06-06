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
        { name: 'All', emoji: '🛒' },
        { name: 'Vegetables', emoji: '🥦' },
        { name: 'Fresh Fruit', emoji: '🍓' },
        { name: 'Meat', emoji: '🥩' },
        { name: 'Seafood', emoji: '🦐' },
        { name: 'Eggs', emoji: '🥚' },
        { name: 'Baking', emoji: '🍞' },
        { name: 'Drinks', emoji: '🧃' },
        { name: 'Cheese', emoji: '🧀' },
        { name: 'Milk', emoji: '🥛' },
    ];

    activeSubNav = 'All';

    /* ── Icon category row ── */
    readonly iconCategories = [
        { name: 'Vegetables', emoji: '🥦', bg: '#eaf7ef' },
        { name: 'Fresh Fruit', emoji: '🍎', bg: '#fdeef0' },
        { name: 'Meat', emoji: '🥩', bg: '#fbeceb' },
        { name: 'Seafood', emoji: '🦐', bg: '#eaf3fb' },
        { name: 'Eggs', emoji: '🥚', bg: '#fdf6e7' },
        { name: 'Baking', emoji: '🍞', bg: '#f7efe6' },
        { name: 'Drinks', emoji: '🧃', bg: '#eef0fb' },
        { name: 'Cheese', emoji: '🧀', bg: '#fdfae7' },
        { name: 'Milk', emoji: '🥛', bg: '#eef0fb' },
    ];

    /* ── Sidebar filter categories ── */
    readonly sidebarCategories = [
        { name: 'Baking', count: 4 },
        { name: 'Cheese', count: 6 },
        { name: 'Drinks', count: 12 },
        { name: 'Eggs', count: 3 },
        { name: 'Juice', count: 5 },
        { name: 'Fresh Fruit', count: 18 },
        { name: 'Meat', count: 14 },
        { name: 'Seafood', count: 8 },
        { name: 'Vegetables', count: 22 },
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
        { name: 'France', flag: '🇫🇷' },
        { name: 'Germany', flag: '🇩🇪' },
        { name: 'Vietnam', flag: '🇻🇳' },
        { name: 'USA', flag: '🇺🇸' },
    ];
    readonly unitOptions = ['Piece', 'Bunch', 'Pack', 'Kg', 'Box'];
    selectedUnit = 'Piece';

    /* ── Sort ── */
    sortBy = 'default';
    readonly sortOptions = [
        { value: 'default', label: 'Default sorting' },
        { value: 'price-asc', label: 'Price: Low to High' },
        { value: 'price-desc', label: 'Price: High to Low' },
        { value: 'rating', label: 'Best Rating' },
        { value: 'newest', label: 'Newest' },
    ];

    /* ── Products ── */
    readonly allProducts: ShopProduct[] = [
        { id: 1, name: 'Spring Onion Bunch', vendor: 'NestFood', emoji: '🧅', bg: '#eaf7ef', price: 10.0, oldPrice: 13.0, rating: 4, reviews: 35, badge: 'Bestseller', badgeClass: 'shop-badge--amber', description: 'Fresh spring onions sourced from local farms, great for stir-fry and salads.', qty: 1 },
        { id: 2, name: 'Basil Leaves', vendor: 'NestFood', emoji: '🌿', bg: '#eaf7ef', price: 8.0, oldPrice: 11.0, rating: 5, reviews: 22, badge: 'New', badgeClass: 'shop-badge--blue', description: 'Aromatic fresh basil, perfect for pasta, pizza and pesto sauces.', qty: 1 },
        { id: 3, name: 'Carrots 1 Kg', vendor: 'NestFood', emoji: '🥕', bg: '#fff4e6', price: 7.0, rating: 4, reviews: 41, description: 'Crisp sweet carrots harvested fresh. Great for juicing, roasting or snacking.', qty: 1 },
        { id: 4, name: 'Fine Radish 1 Pack', vendor: 'NestFood', emoji: '🌶️', bg: '#fdeef0', price: 20.0, oldPrice: 25.0, rating: 5, reviews: 18, description: 'Crisp peppery radishes that add colour and crunch to any dish.', qty: 1 },
        { id: 5, name: 'Wild Garlic 500g', vendor: 'NestFood', emoji: '🧄', bg: '#fdf6e7', price: 20.0, rating: 3, reviews: 9, description: 'Intensely flavoured wild garlic. Ideal for soups, sauces and butter.', qty: 1 },
        { id: 6, name: 'Chestnut Mushroom 300g', vendor: 'NestFood', emoji: '🍄', bg: '#f7efe6', price: 10.0, oldPrice: 13.0, rating: 4, reviews: 30, badge: 'Hot', badgeClass: 'shop-badge--rose', description: 'Earthy nutty chestnut mushrooms, ideal for risotto and pasta dishes.', qty: 1 },
        { id: 7, name: 'Avocados 2 Units', vendor: 'NestFood', emoji: '🥑', bg: '#eef7e9', price: 9.0, oldPrice: 12.0, rating: 5, reviews: 54, description: 'Creamy ripe Hass avocados. Rich in healthy fats and perfect for guacamole.', qty: 1, colors: ['#22c55e', '#1c1917', '#eab308'] },
        { id: 8, name: 'Kiwi', vendor: 'NestFood', emoji: '🥝', bg: '#eaf7ef', price: 10.0, rating: 4, reviews: 12, description: 'Tangy sweet kiwi fruit packed with vitamin C and antioxidants.', qty: 1 },
        { id: 9, name: 'Fresh Coconut 1 Unit', vendor: 'NestFood', emoji: '🥥', bg: '#fdf6e7', price: 45.0, oldPrice: 50.0, rating: 4, reviews: 27, description: 'Whole fresh coconut with sweet water and tender white meat inside.', qty: 1, available: 26 },
        { id: 10, name: 'Strawberries 250g', vendor: 'NestFood', emoji: '🍓', bg: '#fdeef0', price: 9.99, oldPrice: 12.99, rating: 5, reviews: 63, badge: 'Sale', badgeClass: 'shop-badge--primary', description: 'Sun-ripened strawberries, sweet with a bright ruby red colour.', qty: 1 },
        { id: 11, name: 'Blueberries 125g', vendor: 'NestFood', emoji: '🫐', bg: '#eef0fb', price: 40.0, rating: 4, reviews: 19, description: 'Plump juicy blueberries bursting with natural sweetness and antioxidants.', qty: 1 },
        { id: 12, name: 'Blackcurrant', vendor: 'NestFood', emoji: '🍇', bg: '#f5eefb', price: 10.0, rating: 3, reviews: 8, description: 'Intensely flavoured blackcurrants. Perfect for jams, sauces and smoothies.', qty: 1 },
        { id: 13, name: 'Green Apples', vendor: 'NestFood', emoji: '🍏', bg: '#eef7e9', price: 29.0, oldPrice: 33.0, rating: 5, reviews: 44, badge: 'Organic', badgeClass: 'shop-badge--primary', description: 'Crisp tart Granny Smith apples. Great fresh, baked or in green smoothies.', qty: 1 },
        { id: 14, name: 'Seedless Grapes', vendor: 'NestFood', emoji: '🍇', bg: '#f5eefb', price: 14.0, rating: 4, reviews: 31, description: 'Sweet seedless red grapes. Snack on the go or add to salads and cheese boards.', qty: 1, colors: ['#ef4444', '#1c1917'] },
        { id: 15, name: 'Halal Chuck Steak 400g', vendor: 'NestFood', emoji: '🥩', bg: '#fbeceb', price: 159.0, oldPrice: 180.0, rating: 4, reviews: 21, badge: 'Halal', badgeClass: 'shop-badge--amber', description: 'Premium chuck steak, slow-cooked for rich tender flavour. Halal certified.', qty: 1 },
        { id: 16, name: 'Sliced Beef Halloumi', vendor: 'NestFood', emoji: '🧀', bg: '#fdfae7', price: 177.0, rating: 5, reviews: 36, description: 'Golden halloumi with a delicious salty flavour. Great grilled or pan-fried.', qty: 1 },
        { id: 17, name: 'Filipino Royal Beef Sioklun', vendor: 'NestFood', emoji: '🥩', bg: '#fbeceb', price: 160.0, oldPrice: 200.0, rating: 4, reviews: 14, badge: 'Hot', badgeClass: 'shop-badge--rose', description: 'Authentic Filipino-style beef roll marinated in a classic savoury sauce.', qty: 1, available: 38 },
        { id: 18, name: 'Whole Duck 1.7–2.5 Kg', vendor: 'NestFood', emoji: '🦆', bg: '#fdf2e7', price: 250.0, rating: 4, reviews: 11, description: 'Free-range whole duck with rich flavourful meat, perfect for roasting.', qty: 1 },
        { id: 19, name: 'Chicken Breast Mince', vendor: 'NestFood', emoji: '🍗', bg: '#fdf6e7', price: 71.0, oldPrice: 90.0, rating: 5, reviews: 48, description: 'Lean chicken breast mince. Ideal for burgers, meatballs and healthy meals.', qty: 1 },
        { id: 20, name: 'Freshly Frozen Whole Pigeon', vendor: 'NestFood', emoji: '🐦', bg: '#eef0fb', price: 145.0, oldPrice: 160.0, rating: 4, reviews: 7, description: 'Whole frozen pigeon, tender and flavourful for braising or slow-cooking.', qty: 1 },
        { id: 21, name: 'Scottish Lamb Selection Box', vendor: 'NestFood', emoji: '🥩', bg: '#fbeceb', price: 99.0, oldPrice: 115.0, rating: 5, reviews: 23, badge: 'Bestseller', badgeClass: 'shop-badge--amber', description: 'Premium Scottish lamb cuts in a gourmet selection box, direct from the farm.', qty: 1 },
        { id: 22, name: 'Marmalade Boneless Raisin Box', vendor: 'NestFood', emoji: '🍖', bg: '#fdf2e7', price: 99.0, rating: 3, reviews: 5, description: 'Sweet marmalade-glazed boneless pork with juicy raisins throughout.', qty: 1 },
        { id: 23, name: 'Black Cotton Steak', vendor: 'NestFood', emoji: '🥩', bg: '#fbeceb', price: 160.0, oldPrice: 190.0, rating: 4, reviews: 17, description: 'Dry-aged black cotton steak with intense beefy flavour and beautiful marbling.', qty: 1 },
        { id: 24, name: 'Cold Smoked Salmon 400g', vendor: 'OceanCo', emoji: '🐟', bg: '#eaf3fb', price: 60.0, oldPrice: 75.0, rating: 5, reviews: 52, badge: 'New', badgeClass: 'shop-badge--blue', description: 'Silky Norwegian cold smoked salmon with a mild smoky flavour. Sliced ready.', qty: 1 },
        { id: 25, name: 'Fresh Whole Lotus Fish', vendor: 'OceanCo', emoji: '🐠', bg: '#eaf3fb', price: 44.0, rating: 4, reviews: 20, description: 'Whole fresh lotus fish sustainably sourced. Light, flaky white flesh.', qty: 1 },
        { id: 26, name: 'Jumbo King Prawns 6 Pieces', vendor: 'OceanCo', emoji: '🦐', bg: '#eaf3fb', price: 400.0, oldPrice: 450.0, rating: 5, reviews: 39, badge: 'Hot', badgeClass: 'shop-badge--rose', description: 'XL king prawns, perfect for grilling, stir-fry or a classic prawn cocktail.', qty: 1 },
        { id: 27, name: 'King Prawns Peeled', vendor: 'OceanCo', emoji: '🦐', bg: '#eaf3fb', price: 60.0, rating: 4, reviews: 28, description: 'Pre-peeled ready-to-cook king prawns. Saves time for weeknight dinners.', qty: 1 },
        { id: 28, name: 'Prawns Mixed Halvar', vendor: 'OceanCo', emoji: '🦞', bg: '#eaf3fb', price: 30.0, oldPrice: 40.0, rating: 3, reviews: 10, description: 'A mixed selection of Atlantic prawns and langoustines in a single portion.', qty: 1 },
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
        this.selectedCategory = name === 'All' ? '' : name;
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
        if (this.selectedCategory && this.selectedCategory !== 'All') {
            const map: Record<string, string[]> = {
                Vegetables: ['🥦', '🥕', '🧄', '🥬', '🧅', '🌶️', '🌿'],
                'Fresh Fruit': ['🍎', '🍓', '🥝', '🍏', '🫐', '🍇', '🥥'],
                Meat: ['🥩', '🍗', '🍖', '🦆', '🐦'],
                Seafood: ['🦐', '🐟', '🐠', '🦞'],
                Eggs: ['🥚'],
                Baking: ['🍞', '🥖'],
                Drinks: ['🧃', '🥤'],
                Cheese: ['🧀'],
                Milk: ['🥛'],
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
