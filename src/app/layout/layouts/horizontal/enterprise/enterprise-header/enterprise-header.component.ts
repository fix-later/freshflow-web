import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import {
    FuseHorizontalNavigationComponent,
    FuseNavigationItem,
} from '@fuse/components/navigation';
import { NotificationsComponent } from 'app/layout/common/notifications/notifications.component';
import { UserComponent } from 'app/layout/common/user/user.component';

@Component({
    selector: 'enterprise-header',
    templateUrl: './enterprise-header.component.html',
    styleUrls: ['./enterprise-header.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
    imports: [
        RouterLink,
        FormsModule,
        MatButtonModule,
        MatIconModule,
        FuseHorizontalNavigationComponent,
        NotificationsComponent,
        UserComponent,
    ],
})
export class EnterpriseHeaderComponent {
    @Input({ required: true }) isScreenSmall: boolean;
    @Input({ required: true }) navigation: FuseNavigationItem[];

    @Output() readonly toggleNavigation = new EventEmitter<void>();
    @Output() readonly openSearch = new EventEmitter<void>();
    @Output() readonly openAiChat = new EventEmitter<void>();

    searchQuery = '';
    storeName = 'PASSION_FPT';
    megaMenuOpen = false;

    readonly megaCategories = [
        {
            name: 'Vegetables',
            emoji: '🥦',
            sub: [
                'Leafy Vegetables',
                'Root Vegetables',
                'Onions & Shallots',
                'Tomatoes',
                'Mushrooms',
                'Potatoes & Yams',
                'Cucumbers',
                'Squash & Zucchini',
                'Corn',
            ],
        },
        {
            name: 'Meat & Poultry',
            emoji: '🥩',
            sub: [
                'Beef',
                'Poultry',
                'Pork',
                'Lamb',
                'Deli Meat',
                'Pre-Packaged',
                'Exotic Meat',
            ],
        },
        {
            name: 'Bread & Bakery',
            emoji: '🍞',
            sub: [
                'Sweet Bread',
                'Savory Bread',
                'With Filling',
                'Toast',
                'Biscuit & Cake',
                'Sliced Bread',
                'Other',
            ],
        },
        {
            name: 'Fruits',
            emoji: '🍓',
            sub: [
                'Stonefruits',
                'Apples',
                'Pears',
                'Melons',
                'Grapes',
                'Berries',
                'Citrus',
                'Persimmons',
                'Tropical',
            ],
        },
        {
            name: 'Beverages',
            emoji: '🧃',
            sub: [
                'Tea',
                'Soft Drinks',
                'Fruit Drinks',
                'Milk Drinks',
                'Rice & Soy Drinks',
                'Coffee',
                'Sports Drinks',
                'Other',
            ],
        },
        {
            name: 'Snacks',
            emoji: '🍿',
            sub: [
                'Candy',
                'Chips',
                'Crackers & Cookies',
                'Nuts & Seeds',
                'Seaweed',
                'Dried Bean Curd',
                'Jerkies',
                'Dried Seafood',
                'Dried Fruits',
            ],
        },
    ];

    readonly contactInfo = [
        {
            icon: 'heroicons_outline:map-pin',
            text: '25 West 21th Street, Miami FL, USA',
        },
        {
            icon: 'heroicons_outline:clock',
            text: 'Mon-Fri: 10:00 - 18:00',
        },
        {
            icon: 'heroicons_outline:phone',
            text: '+1 900 777525',
            href: 'tel:+1900777525',
        },
    ];

    wishlistCount = 0;
    cartCount = 0;

    onBrowseCategories(): void {
        this.toggleNavigation.emit();
    }

    onMobileMenu(): void {
        this.toggleNavigation.emit();
    }

    onSearchSubmit(): void {
        this.openSearch.emit();
    }

    onOpenAiChat(): void {
        this.openAiChat.emit();
    }
}
