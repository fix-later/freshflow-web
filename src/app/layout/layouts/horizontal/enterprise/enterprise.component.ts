import { NgClass } from '@angular/common';
import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    inject,
    OnDestroy,
    OnInit,
    Signal,
    signal,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
    Router,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
} from '@angular/router';
import { FuseLoadingBarComponent } from '@fuse/components/loading-bar';
import {
    FuseNavigationItem,
    FuseNavigationService,
    FuseVerticalNavigationComponent,
} from '@fuse/components/navigation';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { TranslocoModule } from '@jsverse/transloco';
import { FuseRouteAnimationDirective } from 'app/core/animations/route-animation.directive';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { Navigation } from 'app/core/navigation/navigation.types';
import { BranchPickerComponent } from 'app/layout/common/branch-picker/branch-picker.component';
import { DraftOrderDrawerComponent } from 'app/layout/common/draft-order/draft-order-drawer.component';
import { DraftOrderComponent } from 'app/layout/common/draft-order/draft-order.component';
import { FavoritesDrawerComponent } from 'app/layout/common/favorites/favorites-drawer.component';
import { FavoritesComponent } from 'app/layout/common/favorites/favorites.component';
import { LanguagesComponent } from 'app/layout/common/languages/languages.component';
import { NotificationsComponent } from 'app/layout/common/notifications/notifications.component';
import { OrderTrackingComponent } from 'app/layout/common/order-tracking/order-tracking.component';
import { QuickSignInComponent } from 'app/layout/common/quick-sign-in/quick-sign-in.component';
import { UserComponent } from 'app/layout/common/user/user.component';
import { fromEvent, Subject, takeUntil } from 'rxjs';

interface AiChatMessage {
    role: 'user' | 'assistant';
    text: string;
}

/** Show the scroll-top control after the user has scrolled this far. */
const SCROLL_TOP_THRESHOLD_PX = 400;

@Component({
    selector: 'enterprise-layout',
    templateUrl: './enterprise.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        FuseLoadingBarComponent,
        FuseVerticalNavigationComponent,
        BranchPickerComponent,
        DraftOrderComponent,
        DraftOrderDrawerComponent,
        FavoritesComponent,
        FavoritesDrawerComponent,
        LanguagesComponent,
        NotificationsComponent,
        OrderTrackingComponent,
        QuickSignInComponent,
        UserComponent,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTabsModule,
        MatTooltipModule,
        FormsModule,
        NgClass,
        RouterLink,
        RouterLinkActive,
        RouterOutlet,
        FuseRouteAnimationDirective,
        TranslocoModule,
    ],
})
export class EnterpriseLayoutComponent
    implements OnInit, AfterViewInit, OnDestroy
{
    @ViewChild('aiChatInput') aiChatInput: ElementRef<HTMLInputElement>;
    @ViewChild('stickySentinel')
    private _stickySentinel: ElementRef<HTMLElement>;

    private _permissionsService = inject(PermissionsService);
    private _router = inject(Router);
    private _stickyObserver: IntersectionObserver | null = null;

    isScreenSmall: boolean;
    navigation: Navigation;

    /**
     * True once the top strip scrolls out: the main bar detaches and pins
     * to the viewport top (with a slide-in), a spacer keeps the layout.
     */
    readonly isMainBarStuck = signal(false);

    /** Guests see sign-in / sign-up in the header instead of the user menu. */
    readonly isSignedIn: Signal<boolean> = computed(
        () => this._permissionsService.role() !== null
    );

    /** Floating control: jump back to the top of the page. */
    readonly showScrollTop = signal(false);

    // Header state
    searchQuery = '';
    megaMenuOpen = false;

    readonly megaCategories = [
        {
            name: 'Rau củ',
            emoji: '🥦',
            sub: [
                'Rau ăn lá',
                'Củ quả',
                'Hành & hành tím',
                'Cà chua',
                'Nấm',
                'Khoai tây & khoai lang',
                'Dưa leo',
                'Bí & bí ngòi',
                'Bắp',
            ],
        },
        {
            name: 'Thịt & gia cầm',
            emoji: '🥩',
            sub: [
                'Thịt bò',
                'Gia cầm',
                'Thịt heo',
                'Thịt cừu',
                'Thịt nguội',
                'Đóng gói sẵn',
                'Thịt đặc sản',
            ],
        },
        {
            name: 'Bánh mì & bánh ngọt',
            emoji: '🍞',
            sub: [
                'Bánh ngọt',
                'Bánh mặn',
                'Bánh có nhân',
                'Bánh mì nướng',
                'Bánh quy & bánh kem',
                'Bánh mì lát',
                'Khác',
            ],
        },
        {
            name: 'Trái cây',
            emoji: '🍓',
            sub: [
                'Quả hạch',
                'Táo',
                'Lê',
                'Dưa',
                'Nho',
                'Quả mọng',
                'Cam quýt',
                'Hồng',
                'Trái cây nhiệt đới',
            ],
        },
        {
            name: 'Đồ uống',
            emoji: '🧃',
            sub: [
                'Trà',
                'Nước ngọt',
                'Nước trái cây',
                'Sữa',
                'Sữa gạo & đậu nành',
                'Cà phê',
                'Nước thể thao',
                'Khác',
            ],
        },
        {
            name: 'Ăn vặt',
            emoji: '🍿',
            sub: [
                'Kẹo',
                'Snack khoai',
                'Bánh quy giòn',
                'Hạt & đậu',
                'Rong biển',
                'Tàu hũ ky',
                'Đồ khô',
                'Hải sản khô',
                'Trái cây sấy',
            ],
        },
    ];

    /** Value props shown on the left of the top strip. */
    readonly topBenefits = [
        {
            icon: 'heroicons_outline:truck',
            text: 'Giao hàng từ 6h sáng',
        },
        {
            icon: 'heroicons_outline:receipt-percent',
            text: 'VAT đầy đủ',
        },
        {
            icon: 'heroicons_outline:lifebuoy',
            text: 'Hỗ trợ 24/24',
        },
    ];

    /** Support hotline, shown at the right end of the nav row. */
    readonly hotline = {
        text: '+1 900 777525',
        href: 'tel:+1900777525',
    };

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

        fromEvent(window, 'scroll', { passive: true })
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this._updateScrollTopVisibility());

        this._updateScrollTopVisibility();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
        this._stickyObserver?.disconnect();
    }

    ngAfterViewInit(): void {
        // Pin the main bar once the sentinel (sitting right above it)
        // scrolls past the viewport top. IntersectionObserver instead of a
        // scroll listener: no per-frame work, and the spacer keeps the
        // sentinel's position stable while the bar is pinned.
        const sentinel = this._stickySentinel?.nativeElement;
        if (!sentinel) {
            return;
        }
        this._stickyObserver = new IntersectionObserver(
            ([entry]) =>
                this.isMainBarStuck.set(
                    !entry.isIntersecting && entry.boundingClientRect.top < 0
                ),
            { threshold: 0 }
        );
        this._stickyObserver.observe(sentinel);
    }

    /** True when any child link of a dropdown nav item is the active route. */
    isBranchActive(item: FuseNavigationItem): boolean {
        return !!item.children?.some(
            (child) =>
                !!child.link &&
                this._router.isActive(child.link, {
                    paths: 'subset',
                    queryParams: 'subset',
                    fragment: 'ignored',
                    matrixParams: 'ignored',
                })
        );
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

    scrollToTop(): void {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    private _updateScrollTopVisibility(): void {
        const y =
            window.scrollY ||
            document.documentElement.scrollTop ||
            document.body.scrollTop ||
            0;
        this.showScrollTop.set(y > SCROLL_TOP_THRESHOLD_PX);
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
