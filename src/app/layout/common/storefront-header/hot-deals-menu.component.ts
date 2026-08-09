import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    NgZone,
    signal,
    untracked,
    ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { GuestGateService } from 'app/core/auth/guest-gate.service';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { FavoritesService } from 'app/layout/common/favorites/favorites.service';
import { CatalogService } from 'app/modules/catalog/catalog.service';
import {
    CatalogCategory,
    CatalogProduct,
} from 'app/modules/catalog/catalog.types';
import { categoryVisual } from 'app/shared/product-card/category-visual';
import { ProductCardComponent } from 'app/shared/product-card/product-card.component';
import { ProductCardVm } from 'app/shared/product-card/product-card.types';
import { fromEvent, merge } from 'rxjs';

/** One rail row: a category and the featured listings filed under it. */
export interface HotDealGroup {
    /** Category id, or `''` for listings whose category could not be resolved. */
    id: string;
    /** `null` for the uncategorised bucket — the template labels that one. */
    category: CatalogCategory | null;
    products: CatalogProduct[];
}

/**
 * Tiles shown for the active category before "see all" takes over — one full
 * row of the panel's five columns.
 */
const MAX_TILES_PER_CATEGORY = 5;

/**
 * Grace period before a mouse-out closes the panel. The panel is full-bleed
 * and starts at the header's bottom edge, so the pointer crosses a few pixels
 * of header on its way down from the trigger; closing on the first `mouseleave`
 * would make that trip flicker.
 */
const CLOSE_DELAY_MS = 140;

/**
 * The header's **Hot Deals** menu: the market's featured listings
 * (`MarketProduct.IsFeatured`), grouped into a category rail on the left with
 * the active category's product tiles on the right.
 *
 * Scoped to the market picked in the header — featuring is a per-market
 * decision, so there is nothing to show until a market is chosen.
 *
 * The panel is **full-bleed**: it spans the viewport and hangs off the header's
 * bottom edge, rather than being a dropdown boxed to the trigger. Its height is
 * fixed (see the stylesheet) and its `top` has to be measured ({@link panelTop})
 * because `position: fixed` cannot know where the header ends. Scrolling
 * dismisses it rather than dragging it along.
 *
 * Opens on hover and on keyboard focus, and the trigger stays a real link —
 * to `/catalog?featured=1`, the same view under a filter, since hot deals have
 * no page of their own — so the panel is an enhancement rather than the only
 * way through. Every string is translated, and category / product names follow
 * the active language like the rest of the storefront.
 */
@Component({
    selector: 'hot-deals-menu',
    templateUrl: './hot-deals-menu.component.html',
    styleUrls: ['./hot-deals-menu.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatIconModule,
        MatProgressSpinnerModule,
        ProductCardComponent,
        RouterLink,
        TranslocoModule,
    ],
})
export class HotDealsMenuComponent {
    private _catalogService = inject(CatalogService);
    private _marketSelection = inject(MarketSelectionService);
    private _favoritesService = inject(FavoritesService);
    private _draftOrder = inject(DraftOrderService);
    private _guestGate = inject(GuestGateService);
    private _translocoService = inject(TranslocoService);
    private _host = inject<ElementRef<HTMLElement>>(ElementRef);
    private _ngZone = inject(NgZone);
    private _destroyRef = inject(DestroyRef);

    readonly open = signal(false);
    readonly loading = signal(false);

    /** Viewport offset the full-bleed panel hangs from — the header's bottom. */
    readonly panelTop = signal(0);

    private _closeTimer: ReturnType<typeof setTimeout> | null = null;

    /** The market the deals belong to — drives the "pick a market" state. */
    readonly market = this._marketSelection.selected;

    private readonly _featured = signal<CatalogProduct[]>([]);
    /** `null` until the user picks a rail row; the first group is the default. */
    private readonly _activeId = signal<string | null>(null);

    /**
     * A *signal* for the active language, not `getActiveLang()`: a computed
     * over the plain getter would memoize the language it first saw and never
     * recompute, leaving every derived label stuck after a language switch.
     */
    private readonly _activeLang = toSignal(
        this._translocoService.langChanges$,
        { initialValue: this._translocoService.getActiveLang() }
    );

    readonly isVi = computed(() => this._activeLang() === 'vi');

    /**
     * Featured listings bucketed by category, in the order the category API
     * returned them so the rail matches the catalog sidebar. Listings whose
     * category is missing (or names a category the API did not return) fall
     * into one trailing bucket rather than disappearing.
     */
    readonly groups = computed<HotDealGroup[]>(() => {
        const byCategory = new Map<string, CatalogProduct[]>();
        for (const product of this._featured()) {
            const key = product.categoryId || '';
            const bucket = byCategory.get(key) ?? [];
            bucket.push(product);
            byCategory.set(key, bucket);
        }

        const groups: HotDealGroup[] = [];
        for (const category of this._catalogService.categories()) {
            const products = byCategory.get(category.id);
            if (products?.length) {
                groups.push({ id: category.id, category, products });
                byCategory.delete(category.id);
            }
        }
        // Whatever is left has no category we can name — one trailing bucket.
        const orphans = [...byCategory.values()].flat();
        if (orphans.length) {
            groups.push({ id: '', category: null, products: orphans });
        }
        return groups;
    });

    readonly activeGroup = computed<HotDealGroup | null>(() => {
        const groups = this.groups();
        if (groups.length === 0) {
            return null;
        }
        const active = this._activeId();
        return groups.find((group) => group.id === active) ?? groups[0];
    });

    /**
     * Tiles for the active rail row, capped so the panel keeps its height.
     * Built as a computed rather than mapped in the template: a method call
     * would hand `ff-product-card` a fresh object on every check and defeat
     * its OnPush input comparison.
     */
    readonly activeCards = computed<ProductCardVm[]>(() => {
        const group = this.activeGroup();
        if (!group) {
            return [];
        }
        const eyebrow = group.category
            ? this.categoryLabel(group.category)
            : null;
        return group.products
            .slice(0, MAX_TILES_PER_CATEGORY)
            .map((product) => this._productVm(product, eyebrow));
    });

    /** Keyed by tile id so the card outputs can find their listing again. */
    private readonly _productsById = computed(
        () => new Map(this._featured().map((product) => [product.id, product]))
    );

    readonly hasMoreInCategory = computed(
        () =>
            (this.activeGroup()?.products.length ?? 0) > MAX_TILES_PER_CATEGORY
    );

    constructor() {
        // The rail is labelled from the category list, which the layout also
        // loads for its "Categories" menu. `getCategories()` caches, so asking
        // here only costs a request when this menu is the first to need it.
        this._catalogService
            .getCategories()
            .pipe(takeUntilDestroyed())
            .subscribe();

        // Scrolling (or resizing) dismisses the panel. Its offset is measured
        // once when it opens, so anything that moves the header out from under
        // it would leave it floating — closing is both the honest answer and
        // what a full-bleed menu should do once the user's attention moves to
        // the page. Bound outside Angular because scroll fires continuously;
        // the signal write schedules its own re-render, and only on the first
        // event of a scroll (`open()` is false for the rest).
        this._ngZone.runOutsideAngular(() => {
            merge(
                fromEvent(window, 'scroll', { passive: true }),
                fromEvent(window, 'resize', { passive: true })
            )
                .pipe(takeUntilDestroyed(this._destroyRef))
                .subscribe(() => {
                    if (this.open()) {
                        this.onClose();
                    }
                });
        });

        this._destroyRef.onDestroy(() => {
            if (this._closeTimer) {
                clearTimeout(this._closeTimer);
            }
        });

        // Featuring is per-market, so a market switch invalidates what is on
        // screen. Clearing here (rather than on the next open) means the panel
        // never flashes the previous market's deals.
        effect(() => {
            this._marketSelection.selectedId();
            untracked(() => {
                this._featured.set([]);
                this._activeId.set(null);
                if (this.open()) {
                    void this._load();
                }
            });
        });
    }

    onOpen(): void {
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
        }
        this._measurePanelTop();
        this.open.set(true);
        void this._load();
    }

    /**
     * Deferred so the pointer can cross the sliver of header between the
     * trigger and the panel's top edge without the panel flickering shut.
     */
    onCloseSoon(): void {
        if (this._closeTimer) {
            return;
        }
        this._closeTimer = setTimeout(() => {
            this._closeTimer = null;
            this.open.set(false);
        }, CLOSE_DELAY_MS);
    }

    /** Immediate close — for Escape and for following a link out of the panel. */
    onClose(): void {
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
        }
        this.open.set(false);
    }

    /**
     * Close only when focus actually leaves the menu. `focusout` bubbles on
     * every hop between the trigger, the rail and the tiles, so without the
     * containment check tabbing through the panel would close it immediately.
     */
    onFocusOut(event: FocusEvent): void {
        const host = event.currentTarget as HTMLElement | null;
        const next = event.relatedTarget as Node | null;
        if (!host || !next || !host.contains(next)) {
            this.onClose();
        }
    }

    /**
     * The panel is `position: fixed`, so its offset has to be measured rather
     * than inherited: it hangs off the bottom of the header, not off the
     * trigger's own box. Taken once per open — a scroll closes the panel
     * instead of moving it.
     *
     * Two candidates, because the header has two shapes. In flow it is the
     * `<header>` element's own bottom. When the page is already scrolled the
     * main bar is detached and pinned to the viewport top, and *that* is the
     * header's visible bottom edge while the element behind it sits off-screen
     * — so take whichever is lower. The pinned bar is found by the class the
     * enterprise layout tags it with; if that ever changes, the panel simply
     * falls back to the in-flow header.
     */
    private _measurePanelTop(): void {
        const host = this._host.nativeElement;
        const header = host.closest('header');
        if (!header) {
            this.panelTop.set(Math.max(0, host.getBoundingClientRect().bottom));
            return;
        }
        const pinned = header.querySelector('.fuse-animate-slide-in-top');
        this.panelTop.set(
            Math.max(
                0,
                header.getBoundingClientRect().bottom,
                pinned?.getBoundingClientRect().bottom ?? 0
            )
        );
    }

    /** Escape closes the panel wherever focus sits inside it. */
    onKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape' && this.open()) {
            this.onClose();
        }
    }

    selectCategory(id: string): void {
        this._activeId.set(id);
    }

    isActiveCategory(id: string): boolean {
        return this.activeGroup()?.id === id;
    }

    categoryLabel(category: CatalogCategory): string {
        return this.isVi() ? category.name : category.nameEn;
    }

    /** Guests get the sign-in popup instead of a silent 401 (see GuestGateService). */
    onFavoriteToggled(card: ProductCardVm): void {
        if (!this._guestGate.requireAccount()) {
            return;
        }
        const product = this._productsById().get(card.id);
        if (product) {
            void this._favoritesService.toggle(product);
        }
    }

    onAddedToCart(card: ProductCardVm): void {
        if (!this._guestGate.requireAccount()) {
            return;
        }
        const product = this._productsById().get(card.id);
        if (product) {
            this._draftOrder.add(product);
        }
    }

    private async _load(): Promise<void> {
        const marketId = this._marketSelection.selectedId();
        if (!marketId || this.loading() || this._featured().length > 0) {
            return;
        }
        this.loading.set(true);
        try {
            const featured =
                await this._catalogService.getFeaturedProducts(marketId);
            // The market may have changed while the request was in flight —
            // that switch already cleared the panel, so drop the stale answer.
            if (marketId !== this._marketSelection.selectedId()) {
                return;
            }
            this._featured.set(featured);
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * The same tile view model the catalog grid builds, except the link is
     * absolute: this menu renders on every route, so a relative `productId`
     * would resolve against whatever page the user happens to be on.
     *
     * The ribbon reads "HOT" in both languages — it is the word both locale
     * files already use for this section ("Hot Deals"), so it needs no key.
     */
    private _productVm(
        product: CatalogProduct,
        eyebrow: string | null
    ): ProductCardVm {
        const unit =
            product.unitShort || (this.isVi() ? product.unit : product.unitEn);
        // Guests get no product photos (`GET /products` needs a role), so every
        // tile falls back to a category stand-in rather than a blank box.
        const fallback = categoryVisual(eyebrow ?? product.categoryLabel);
        return {
            id: product.id,
            name: this.isVi() ? product.name : product.nameEn,
            thumbnail: product.thumbnail,
            emoji: fallback.emoji,
            thumbTint: fallback.thumbTint,
            price: this._formatPrice(product.price),
            priceUnit: unit || undefined,
            eyebrow,
            // The unit moved to the price denominator, so it no longer doubles
            // up here — same split the catalog grid uses.
            meta: product.marketSource,
            badge: 'HOT',
            // Brand pink: this strip *is* the deals surface, and `sale` is the
            // token for that (TOKENS.md), where `rose` was an unbound accent.
            badgeClass: 'ff-product-card__badge--sale',
            stock: product.quantity,
            stockUnit: unit,
            favorite: this._favoritesService.isFavorite(
                product.marketProductId
            ),
            inactive: product.active === false,
            link: ['/catalog', product.productId],
        };
    }

    private _formatPrice(price: number | null): string {
        if (price === null) {
            return '—';
        }
        return `${price.toLocaleString(this._activeLang())} ₫`;
    }
}
