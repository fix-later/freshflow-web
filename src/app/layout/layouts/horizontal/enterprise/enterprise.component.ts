import { NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    OnDestroy,
    OnInit,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterOutlet } from '@angular/router';
import { fuseAnimations } from '@fuse/animations/public-api';
import { FuseLoadingBarComponent } from '@fuse/components/loading-bar';
import {
    FuseHorizontalNavigationComponent,
    FuseNavigationService,
    FuseVerticalNavigationComponent,
} from '@fuse/components/navigation';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { Navigation } from 'app/core/navigation/navigation.types';
import { NotificationsComponent } from 'app/layout/common/notifications/notifications.component';
import { UserComponent } from 'app/layout/common/user/user.component';
import { Subject, takeUntil } from 'rxjs';

interface AiChatMessage {
    role: 'user' | 'assistant';
    text: string;
}

@Component({
    selector: 'enterprise-layout',
    templateUrl: './enterprise.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Eager,
    animations: fuseAnimations,
    imports: [
        FuseLoadingBarComponent,
        FuseVerticalNavigationComponent,
        FuseHorizontalNavigationComponent,
        NotificationsComponent,
        UserComponent,
        MatButtonModule,
        MatIconModule,
        FormsModule,
        NgClass,
        RouterLink,
        RouterOutlet,
    ],
})
export class EnterpriseLayoutComponent implements OnInit, OnDestroy {
    @ViewChild('aiChatInput') aiChatInput: ElementRef<HTMLInputElement>;

    isScreenSmall: boolean;
    navigation: Navigation;

    // Header state
    searchQuery = '';
    storeName = 'PASSION_FPT';
    megaMenuOpen = false;
    wishlistCount = 0;
    cartCount = 0;

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

    // AI chat state
    aiChatOpened = false;
    aiQuery = '';
    aiMessages: AiChatMessage[] = [
        {
            role: 'assistant',
            text: "Hi! I'm FreshFlow AI. Ask me about products, orders, or delivery.",
        },
    ];

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _navigationService: NavigationService,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _fuseNavigationService: FuseNavigationService
    ) {}

    get currentYear(): number {
        return new Date().getFullYear();
    }

    ngOnInit(): void {
        this._navigationService.navigation$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((navigation: Navigation) => {
                this.navigation = navigation;
            });

        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                this.isScreenSmall = !matchingAliases.includes('md');
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    toggleNavigation(name: string): void {
        const navigation =
            this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>(
                name
            );

        if (navigation) {
            navigation.toggle();
        }
    }

    // AI chat
    openAiChat(): void {
        if (this.aiChatOpened) {
            return;
        }

        this.aiChatOpened = true;

        setTimeout(() => {
            this.aiChatInput?.nativeElement.focus();
        });
    }

    closeAiChat(): void {
        if (!this.aiChatOpened) {
            return;
        }

        this.aiQuery = '';
        this.aiChatOpened = false;
    }

    onAiKeydown(event: KeyboardEvent): void {
        if (event.code === 'Escape') {
            this.closeAiChat();
            return;
        }

        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendAi();
        }
    }

    sendAi(): void {
        const text = this.aiQuery.trim();

        if (!text) {
            return;
        }

        this.aiMessages = [...this.aiMessages, { role: 'user', text }];
        this.aiQuery = '';

        setTimeout(() => {
            this.aiMessages = [
                ...this.aiMessages,
                {
                    role: 'assistant',
                    text: this._buildMockReply(text),
                },
            ];
        }, 500);
    }

    private _buildMockReply(prompt: string): string {
        return `Thanks for your question about "${prompt}". FreshFlow AI will connect to the backend soon — for now this is a preview of the chat overlay.`;
    }
}
