import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    inject,
    NgZone,
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
    NavigationEnd,
    Router,
    RouterLink,
    RouterOutlet,
} from '@angular/router';
import { FuseLoadingBarComponent } from '@fuse/components/loading-bar';
import {
    FuseNavigationItem,
    FuseNavigationService,
    FuseVerticalNavigationComponent,
} from '@fuse/components/navigation';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { FuseRouteAnimationDirective } from 'app/core/animations/route-animation.directive';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { Navigation } from 'app/core/navigation/navigation.types';
import { ContactFabComponent } from 'app/layout/common/contact-fab/contact-fab.component';
import { DraftOrderDrawerComponent } from 'app/layout/common/draft-order/draft-order-drawer.component';
import { DraftOrderComponent } from 'app/layout/common/draft-order/draft-order.component';
import { FavoritesDrawerComponent } from 'app/layout/common/favorites/favorites-drawer.component';
import { FavoritesComponent } from 'app/layout/common/favorites/favorites.component';
import { MarketPickerComponent } from 'app/layout/common/market-picker/market-picker.component';
import { NotificationsComponent } from 'app/layout/common/notifications/notifications.component';
import { OrderTrackingComponent } from 'app/layout/common/order-tracking/order-tracking.component';
import { QuickBuyComponent } from 'app/layout/common/quick-buy/quick-buy.component';
import { QuickSignInComponent } from 'app/layout/common/quick-sign-in/quick-sign-in.component';
import { StorefrontFooterSimpleComponent } from 'app/layout/common/storefront-footer/storefront-footer-simple.component';
import { StorefrontFooterComponent } from 'app/layout/common/storefront-footer/storefront-footer.component';
import { StorefrontNavRowComponent } from 'app/layout/common/storefront-header/storefront-nav-row.component';
import { StorefrontTopStripComponent } from 'app/layout/common/storefront-header/storefront-top-strip.component';
import { UserComponent } from 'app/layout/common/user/user.component';
import { CatalogService } from 'app/modules/catalog/catalog.service';
import { filter, fromEvent, Subject, takeUntil } from 'rxjs';

interface AiChatMessage {
    role: 'user' | 'assistant';
    text: string;
}

/** Show the scroll-top control after the user has scrolled this far. */
const SCROLL_TOP_THRESHOLD_PX = 400;

/** Marketing / browse routes that keep the detailed storefront footer. */
const FULL_FOOTER_PREFIXES = [
    '/home',
    '/catalog',
    '/about',
    '/faq',
    '/contact',
    '/deals',
] as const;

@Component({
    selector: 'enterprise-layout',
    templateUrl: './enterprise.component.html',
    styleUrls: ['../../../common/header-icon-motion.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        FuseLoadingBarComponent,
        FuseVerticalNavigationComponent,
        MarketPickerComponent,
        DraftOrderComponent,
        DraftOrderDrawerComponent,
        FavoritesComponent,
        FavoritesDrawerComponent,
        NotificationsComponent,
        OrderTrackingComponent,
        QuickBuyComponent,
        QuickSignInComponent,
        ContactFabComponent,
        StorefrontFooterComponent,
        StorefrontFooterSimpleComponent,
        StorefrontTopStripComponent,
        StorefrontNavRowComponent,
        UserComponent,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        FormsModule,
        NgClass,
        NgTemplateOutlet,
        RouterLink,
        RouterOutlet,
        FuseRouteAnimationDirective,
        TranslocoModule,
    ],
})
export class EnterpriseLayoutComponent implements OnInit, OnDestroy {
    @ViewChild('aiChatInput') aiChatInput: ElementRef<HTMLInputElement>;

    /**
     * Re-binds whenever the sentinel enters the view (it lives inside
     * `@if (navigation)`, so a one-shot AfterViewInit often misses it).
     */
    @ViewChild('stickySentinel')
    set stickySentinel(ref: ElementRef<HTMLElement> | undefined) {
        this._bindStickyObserver(ref?.nativeElement ?? null);
    }

    private _permissionsService = inject(PermissionsService);
    private _catalogService = inject(CatalogService);
    private _translocoService = inject(TranslocoService);
    private _router = inject(Router);
    private _ngZone = inject(NgZone);
    private _stickyObserver: IntersectionObserver | null = null;
    private _stickySentinelEl: HTMLElement | null = null;

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

    /** One-shot class pulse so the header logo animates on route change. */
    readonly logoRouteAnim = signal(false);

    /** Skip the initial NavigationEnd so the logo only animates on real navigations. */
    private _logoRouteAnimReady = false;

    /** Current URL — drives the catalog logo swap. */
    private readonly _url = signal(this._router.url);

    /**
     * Catalog: logo-market while expanded; logo-primary once the main bar
     * pins. Elsewhere: logo-primary.
     */
    readonly headerLogoSrc = computed(() => {
        if (this._isCatalogRoute(this._url()) && !this.isMainBarStuck()) {
            return 'images/logo/logo-market.svg';
        }
        return 'images/logo/logo-primary.svg';
    });

    readonly isCatalogRoute = computed(() => this._isCatalogRoute(this._url()));

    /**
     * Detailed marketing footer on browse pages; compact bar elsewhere
     * (profile, orders, cart, onboarding, …).
     */
    readonly showFullFooter = computed(() =>
        this._isFullFooterRoute(this._url())
    );

    // Header state
    searchQuery = '';
    megaMenuOpen = false;

    /** Real categories for the "Danh mục" mega menu — same tree the catalog sidebar uses. */
    readonly megaCategories = this._catalogService.categoryTree;
    readonly megaCategoriesLoading = this._catalogService.categoriesLoading;

    readonly isVi = computed(
        () => this._translocoService.getActiveLang() === 'vi'
    );

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
        // Header is global (rendered on every storefront route), so the mega
        // menu's category data can't wait for the catalog page's own route
        // resolver — load it here instead. `getCategories()` caches, so this
        // costs nothing extra once the catalog page (or another instance of
        // this layout) has already fetched it.
        this._catalogService
            .getCategories()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe();

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

        this._router.events
            .pipe(
                filter(
                    (event): event is NavigationEnd =>
                        event instanceof NavigationEnd
                ),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe((event) => {
                this._url.set(event.urlAfterRedirects);
                if (this._logoRouteAnimReady) {
                    this._pulseLogoRouteAnim();
                } else {
                    this._logoRouteAnimReady = true;
                }
            });

        this._updateScrollTopVisibility();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
        this._stickyObserver?.disconnect();
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

    private _isCatalogRoute(url: string): boolean {
        const path = url.split('?')[0];
        return path === '/catalog' || path.startsWith('/catalog/');
    }

    private _isFullFooterRoute(url: string): boolean {
        const path = url.split('?')[0];
        return FULL_FOOTER_PREFIXES.some(
            (prefix) => path === prefix || path.startsWith(`${prefix}/`)
        );
    }

    /** Restart the logo enter animation (CSS needs class removed then re-added). */
    private _pulseLogoRouteAnim(): void {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        this.logoRouteAnim.set(false);
        requestAnimationFrame(() => {
            this._ngZone.run(() => this.logoRouteAnim.set(true));
        });
    }

    /**
     * Pin the main bar once the sentinel scrolls past the viewport top.
     * IntersectionObserver (no per-frame scroll work); the spacer keeps the
     * sentinel's document position stable while the bar is `position: fixed`.
     */
    private _bindStickyObserver(sentinel: HTMLElement | null): void {
        if (sentinel === this._stickySentinelEl) {
            return;
        }
        this._stickyObserver?.disconnect();
        this._stickyObserver = null;
        this._stickySentinelEl = sentinel;
        if (!sentinel) {
            this.isMainBarStuck.set(false);
            return;
        }
        this._stickyObserver = new IntersectionObserver(
            ([entry]) => {
                const stuck =
                    !entry.isIntersecting && entry.boundingClientRect.top < 0;
                if (stuck === this.isMainBarStuck()) {
                    return;
                }
                this._ngZone.run(() => this.isMainBarStuck.set(stuck));
            },
            { threshold: 0, rootMargin: '-1px 0px 0px 0px' }
        );
        this._stickyObserver.observe(sentinel);
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
                    text: 'FreshFlow AI is not connected yet. Please browse the catalog or contact support.',
                },
            ];
        }, 500);
    }
}
