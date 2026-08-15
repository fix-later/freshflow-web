import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    signal,
    untracked,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { GuestGateService } from 'app/core/auth/guest-gate.service';
import { activeLang, formatVnd } from 'app/core/i18n/active-lang';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { FavoritesService } from 'app/layout/common/favorites/favorites.service';
import { CatalogService } from 'app/modules/catalog/catalog.service';
import {
    CatalogProduct,
    isOrderableListing,
} from 'app/modules/catalog/catalog.types';
import { CarouselComponent } from 'app/shared/carousel/carousel.component';
import { categoryVisual } from 'app/shared/product-card/category-visual';
import { ProductCardComponent } from 'app/shared/product-card/product-card.component';
import { ProductCardVm } from 'app/shared/product-card/product-card.types';

/**
 * Section 2: "Hàng đẹp hôm nay".
 *
 * The market's featured listings as a horizontal rail the buyer can add from
 * without leaving the page. This is the section that makes the landing a
 * storefront instead of a poster, so everything here is optimised for one
 * action: get an item into the order.
 *
 * Tiles are the shared `ff-product-card`, unchanged. Building a second product
 * tile for this page would fork the storefront's most-used component.
 */
@Component({
    selector: 'today-highlights',
    templateUrl: './today-highlights.component.html',
    styleUrls: ['./today-highlights.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CarouselComponent,
        MatIconModule,
        MatProgressSpinnerModule,
        ProductCardComponent,
        RouterLink,
        TranslocoModule,
    ],
})
export class TodayHighlightsComponent {
    private _catalog = inject(CatalogService);
    private _markets = inject(MarketSelectionService);
    private _draftOrder = inject(DraftOrderService);
    private _favorites = inject(FavoritesService);
    private _guestGate = inject(GuestGateService);
    private readonly _destroyRef = inject(DestroyRef);

    private readonly _lang = activeLang();
    readonly isVi = computed(() => this._lang() === 'vi');

    readonly market = this._markets.selected;
    readonly loading = signal(false);

    private readonly _products = signal<CatalogProduct[]>([]);

    /**
     * Built as a computed rather than mapped in the template: a method call
     * would hand every tile a fresh object on each check and defeat the card's
     * OnPush input comparison.
     */
    readonly cards = computed<ProductCardVm[]>(() =>
        this._products().map((product) => this._toVm(product))
    );

    private readonly _byId = computed(
        () => new Map(this._products().map((p) => [p.id, p]))
    );

    /**
     * How many tiles the row shows at once. Fractional on the way down so the
     * next card is half-visible — on a phone that peek is the only thing saying
     * the row goes on, since the arrows are small and easy to miss.
     */
    readonly todayPerView = signal(4);

    constructor() {
        this._trackPerView();
        void this._markets.ensureLoaded();
        void this._favorites.ensureLoaded();

        effect(() => {
            const marketId = this._markets.selectedId();
            untracked(() => {
                this._products.set([]);
                if (marketId) {
                    void this._load(marketId);
                }
            });
        });
    }

    /** Guests get the sign-in popup instead of a silent 401 (see GuestGateService). */
    onAddedToCart(card: ProductCardVm): void {
        if (!this._guestGate.requireAccount()) {
            return;
        }
        const product = this._byId().get(card.id);
        if (product) {
            this._draftOrder.add(product);
        }
    }

    onFavoriteToggled(card: ProductCardVm): void {
        if (!this._guestGate.requireAccount()) {
            return;
        }
        const product = this._byId().get(card.id);
        if (product) {
            void this._favorites.toggle(product);
        }
    }

    /**
     * Keeps {@link todayPerView} in step with the viewport. Two queries rather
     * than a resize listener: the browser only wakes us when a threshold is
     * actually crossed.
     */
    private _trackPerView(): void {
        const wide = window.matchMedia?.('(min-width: 1024px)');
        const medium = window.matchMedia?.('(min-width: 640px)');
        if (!wide || !medium) {
            return;
        }
        const apply = (): void =>
            this.todayPerView.set(
                wide.matches ? 4 : medium.matches ? 2.5 : 1.2
            );
        apply();
        wide.addEventListener('change', apply);
        medium.addEventListener('change', apply);
        this._destroyRef.onDestroy(() => {
            wide.removeEventListener('change', apply);
            medium.removeEventListener('change', apply);
        });
    }

    private async _load(marketId: string): Promise<void> {
        this.loading.set(true);
        try {
            const featured = await this._catalog.getFeaturedProducts(marketId);
            if (marketId !== this._markets.selectedId()) {
                return;
            }
            // Nothing left, or under one whole case, cannot be ordered — the
            // same rule the board and Hot Deals apply, so a pinned listing that
            // has sold out drops out of the day's picks rather than leading
            // with a tile whose button is dead.
            this._products.set(featured.filter(isOrderableListing));
        } finally {
            this.loading.set(false);
        }
    }

    private _toVm(product: CatalogProduct): ProductCardVm {
        const unit =
            product.unitShort || (this.isVi() ? product.unit : product.unitEn);
        // Guests get no product photos (`GET /products` needs a role), so every
        // tile falls back to a category stand-in rather than a blank box.
        const fallback = categoryVisual(product.categoryLabel);
        return {
            id: product.id,
            name: this.isVi() ? product.name : product.nameEn,
            thumbnail: product.thumbnail,
            imageUrl: product.imageUrl || product.thumbnail,
            emoji: fallback.emoji,
            thumbTint: fallback.thumbTint,
            price: formatVnd(product.price, this._lang()),
            priceUnit: unit || undefined,
            // The unit moved to the price denominator, so it no longer doubles
            // up here — same split the catalog grid uses.
            meta: product.marketSource,
            // The word reads the same in both locales, which is why the badge
            // needs no key. It is also the only badge on the page: nothing here
            // claims a discount the system cannot prove.
            badge: 'HOT',
            // Brand pink (`sale`) rather than the unbound `rose` accent — see
            // TOKENS.md: every colour binds a token.
            badgeClass: 'ff-product-card__badge--sale',
            stock: product.quantity,
            stockUnit: unit,
            packWeightKg: product.packWeightKg,
            favorite: this._favorites.isFavorite(product.marketProductId),
            inactive: product.active === false,
            link: ['/catalog', product.productId],
        };
    }
}
