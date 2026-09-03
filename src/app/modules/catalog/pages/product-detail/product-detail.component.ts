import { Location } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    OnInit,
    signal,
    untracked,
    ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { GuestGateService } from 'app/core/auth/guest-gate.service';
import { activeLang, formatVnd } from 'app/core/i18n/active-lang';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { formatRelativeTime } from 'app/core/util/relative-time';
import {
    maxQuantityFor,
    packSizeOf,
} from 'app/layout/common/draft-order/draft-order.rules';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { FavoritesService } from 'app/layout/common/favorites/favorites.service';
import { categoryVisual } from 'app/shared/product-card/category-visual';
import { ProductCardComponent } from 'app/shared/product-card/product-card.component';
import { ProductCardVm } from 'app/shared/product-card/product-card.types';
import { tagClass } from 'app/shared/tag-visual';
import { CatalogService } from '../../catalog.service';
import { CatalogProduct } from '../../catalog.types';

/**
 * How many listings the "more from this aisle" rail shows. Four fills the grid
 * on every breakpoint the storefront uses (2 / 3 / 4 columns) without leaving a
 * ragged last row.
 */
const RELATED_LIMIT = 4;

@Component({
    selector: 'product-detail',
    templateUrl: './product-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { class: 'flex w-full min-w-0 flex-auto flex-col' },
    imports: [
        MatButtonModule,
        MatIconModule,
        MatTabsModule,
        MatTooltipModule,
        ProductCardComponent,
        RouterLink,
        TranslocoModule,
    ],
})
export class ProductDetailComponent implements OnInit {
    private _catalogService = inject(CatalogService);
    private _translocoService = inject(TranslocoService);
    private _favoritesService = inject(FavoritesService);
    private _draftOrder = inject(DraftOrderService);
    private _guestGate = inject(GuestGateService);
    private _marketSelection = inject(MarketSelectionService);
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _location = inject(Location);
    private _destroyRef = inject(DestroyRef);

    /** Chip colour for a tag, keyed on its name so it is the same everywhere. */
    readonly tagClass = tagClass;

    readonly product = this._catalogService.product;
    readonly categories = this._catalogService.categories;

    /**
     * True while there is nothing to look the product up in: listings are
     * per-market, and a shared link can be opened by someone who has not picked
     * one yet. The header picker asks on first visit, so this is a wait, not a
     * dead end — hence a different message from "no such product".
     */
    readonly awaitingMarket = computed(
        () => !this.product() && !this._marketSelection.hasSelection()
    );

    readonly selectedIndex = signal(0);

    /**
     * The active language as a **signal**, not `getActiveLang()`: everything
     * below is a computed, and a plain method call is invisible to the reactive
     * graph — the page kept the language it was opened in until it was
     * navigated away from and back.
     */
    private readonly _lang = activeLang();

    readonly isVi = computed(() => this._lang() === 'vi');

    /** Gallery images, falling back to the thumbnail when no images[] are set. */
    readonly galleryImages = computed<string[]>(() => {
        const product = this.product();
        if (!product) {
            return [];
        }
        const images = product.images?.length
            ? product.images
            : [product.thumbnail];
        // A guest gets no photos at all (`GET /products` needs a role), so the
        // list can be a single empty string — drop it rather than render a
        // broken <img>; the category stand-in takes over.
        return images.filter((image) => !!image);
    });

    readonly mainImage = computed<string>(
        () => this.galleryImages()[this.selectedIndex()] ?? ''
    );

    /**
     * Emoji + tint standing in for a product with no photo — the same fallback
     * the grid tiles use, so an un-photographed listing looks deliberate here
     * instead of looking broken.
     */
    readonly fallbackVisual = computed(() => {
        const product = this.product();
        return categoryVisual(
            product
                ? this.categoryName(product.categoryId) || product.categoryLabel
                : ''
        );
    });

    /** Short unit ("kg") for the price denominator and stock count. */
    readonly unitShort = computed(() => {
        const product = this.product();
        if (!product) {
            return '';
        }
        return (
            product.unitShort || (this.isVi() ? product.unit : product.unitEn)
        );
    });

    // ---- Quantity -------------------------------------------------------
    //
    // A market product is picked and shipped by the whole case, so the stepper
    // counts **cases** and the quantity sent to the cart is `cases × packSize`
    // — the same arithmetic `DraftOrderService.add` would do for a single case,
    // just exposed so a buyer can order four without pressing "add" four times.

    readonly cases = signal(1);

    /** Kilograms in one case; 1 for a listing with no packing code. */
    readonly packSize = computed(() => {
        const product = this.product();
        return product ? packSizeOf(product) : 1;
    });

    /** Whole cases this listing can still supply, or `null` when unreported. */
    readonly maxCases = computed<number | null>(() => {
        const product = this.product();
        if (!product) {
            return null;
        }
        const max = maxQuantityFor(product);
        return max === null ? null : Math.floor(max / packSizeOf(product));
    });

    /** What the stepper currently asks for, in the unit the cart holds (kg). */
    readonly quantity = computed(() => this.cases() * this.packSize());

    /** "30 kg" — what the stepper adds up to, for the subtotal line. */
    readonly quantityLabel = computed(() =>
        `${this.quantity().toLocaleString(this._lang())} ${this.unitShort()}`.trim()
    );

    readonly subtotal = computed<number | null>(() => {
        const price = this.product()?.price;
        return price === null || price === undefined
            ? null
            : price * this.quantity();
    });

    readonly canDecrease = computed(() => this.cases() > 1);

    readonly canIncrease = computed(() => {
        const max = this.maxCases();
        return max === null || this.cases() < max;
    });

    /** "2 giờ trước" — how long ago the market last restated this listing. */
    readonly updatedNote = computed(() =>
        formatRelativeTime(this.product()?.updatedAt, this._lang())
    );

    /** "40 kg" — what is left to sell, for the line under the price. */
    readonly availableNote = computed(() => {
        const available = this.product()?.quantity;
        if (available === null || available === undefined) {
            return '';
        }
        return `${available.toLocaleString(this._lang())} ${this.unitShort()}`.trim();
    });

    // ---- Related listings ----------------------------------------------

    private readonly _related = signal<CatalogProduct[]>([]);

    private readonly _relatedById = computed(
        () => new Map(this._related().map((product) => [product.id, product]))
    );

    /**
     * Built as a computed rather than mapped in the template: a method call
     * would hand every tile a fresh object on each check and defeat the card's
     * OnPush input comparison.
     */
    readonly relatedCards = computed<ProductCardVm[]>(() =>
        this._related().map((product) => this._toCard(product))
    );

    constructor() {
        // Resolve again once the picker settles on a market. Without this, a
        // link opened before that choice would sit on its empty state until the
        // visitor thought to reload.
        effect(() => {
            const marketId = this._marketSelection.selectedId();
            if (!marketId || untracked(() => this.product())) {
                return;
            }
            const productId = this._route.snapshot.paramMap.get('productId');
            if (!productId) {
                return;
            }
            this._catalogService
                .getProductById(productId)
                .pipe(takeUntilDestroyed(this._destroyRef))
                // A failed listing read leaves the empty state up; it is the
                // same answer as an empty listing, and the page has nothing
                // else to show either way.
                .subscribe({ error: () => undefined });
        });

        // A different listing is a different offer: the gallery goes back to
        // the first photo and the stepper back to one case, so navigating
        // between two products cannot carry four cases of the first one over.
        effect(() => {
            const id = this.product()?.id;
            untracked(() => {
                this.selectedIndex.set(0);
                this.cases.set(1);
                this._related.set([]);
                if (id) {
                    void this._loadRelated();
                }
            });
        });
    }

    ngOnInit(): void {
        // Deep-linkable route — ensure favorites are loaded even if the
        // header trigger never rendered first.
        void this._favoritesService.ensureLoaded();
    }

    selectImage(index: number): void {
        this.selectedIndex.set(index);
    }

    /** One case fewer, never below the single case a line has to start at. */
    decrease(): void {
        this.cases.update((cases) => Math.max(1, cases - 1));
    }

    /** One case more, up to the last whole case the listing can fill. */
    increase(): void {
        const max = this.maxCases();
        this.cases.update((cases) =>
            max === null ? cases + 1 : Math.min(max, cases + 1)
        );
    }

    isFavorite(product: CatalogProduct): boolean {
        return this._favoritesService.isFavorite(product.marketProductId);
    }

    /** Guests get the sign-in popup — a favourite is stored per account. */
    toggleFavorite(product: CatalogProduct): void {
        if (!this._guestGate.requireAccount()) {
            return;
        }
        void this._favoritesService.toggle(product);
    }

    /**
     * Same draft-order entry point the catalog grid and wishlist use, with the
     * stepper's case count instead of the single case it defaults to.
     *
     * `canOrder` is re-checked rather than trusted to the disabled button: this
     * page is reachable by link for a listing the board hides, and the stock it
     * judges on can fall under a case while the page is open. The service
     * clamps the quantity to what the listing can still supply either way.
     */
    addToDraftOrder(product: CatalogProduct): void {
        if (!this.canOrder(product) || !this._guestGate.requireAccount()) {
            return;
        }
        this._draftOrder.add(product, this.quantity());
    }

    /** Only an explicit zero is out of stock; a missing count is unreported. */
    isOutOfStock(product: CatalogProduct): boolean {
        return product.quantity === 0;
    }

    /** No packing code configured — there is no whole-case quantity to add. */
    hasNoPackingCode(product: CatalogProduct): boolean {
        return product.packWeightKg === null || product.packWeightKg <= 0;
    }

    /**
     * Stock exists but is under one whole case — just as unorderable as none,
     * since adding a fresh line always seeds one full case regardless of what
     * is on hand (`DraftOrderService.add`'s default quantity).
     */
    hasInsufficientStock(product: CatalogProduct): boolean {
        if (
            product.quantity === null ||
            product.packWeightKg === null ||
            product.packWeightKg <= 0
        ) {
            return false;
        }
        return product.quantity < product.packWeightKg;
    }

    canOrder(product: CatalogProduct): boolean {
        return (
            product.active !== false &&
            !this.isOutOfStock(product) &&
            !this.hasNoPackingCode(product) &&
            !this.hasInsufficientStock(product)
        );
    }

    /**
     * Back to wherever the shopper came from — the board, a search, the
     * wishlist — rather than to one fixed page, because this route is reached
     * from all of them.
     *
     * A page opened from a shared link has no in-app step to go back to
     * (`history.length` is 1 in a fresh tab), and `Location.back()` there would
     * hand the visitor to whatever site sent them. That case lands on the
     * catalog instead: it is where the trail this page shows leads anyway.
     */
    goBack(): void {
        if (window.history.length > 1) {
            this._location.back();
            return;
        }
        void this._router.navigate(['/catalog']);
    }

    categoryName(categoryId: string): string {
        const cat = this.categories().find((c) => c.id === categoryId);
        if (!cat) {
            return '';
        }
        return this.isVi() ? cat.name : cat.nameEn;
    }

    formatPrice(price: number | null): string {
        return formatVnd(price, this._lang());
    }

    /** Guests get the sign-in popup rather than a silent 401, as everywhere. */
    onRelatedAddToCart(card: ProductCardVm): void {
        const product = this._relatedById().get(card.id);
        if (product) {
            this.addRelatedToDraftOrder(product);
        }
    }

    onRelatedFavoriteToggled(card: ProductCardVm): void {
        const product = this._relatedById().get(card.id);
        if (product) {
            this.toggleFavorite(product);
        }
    }

    /** A rail tile adds one case, the same as it would on the catalog grid. */
    private addRelatedToDraftOrder(product: CatalogProduct): void {
        if (!this.canOrder(product) || !this._guestGate.requireAccount()) {
            return;
        }
        this._draftOrder.add(product);
    }

    /**
     * Other listings from the same aisle at this market that can actually be
     * bought right now.
     *
     * Unorderable rows — out of stock, no packing code, less than one whole
     * case left — are left out. BR-PRI-1 keeps them on the **board**, where a
     * buyer went looking for them and their absence would read as a gap in the
     * catalogue; this rail is a suggestion nobody asked for, and suggesting
     * something that cannot be added to an order is worse than suggesting
     * nothing.
     *
     * Costs no request: the detail route resolves its product out of the
     * market's crawled listing, so by the time this runs the whole listing is
     * already cached and this is a filter over it.
     */
    private async _loadRelated(): Promise<void> {
        const product = this.product();
        const marketId = this._marketSelection.selectedId();
        if (!product || !marketId) {
            return;
        }
        const listing = await this._catalogService.peekMarketListing(marketId);
        // The product may have changed while the (already resolved) listing
        // promise settled — a rail of the previous product's aisle would be
        // worse than none.
        if (this.product()?.id !== product.id) {
            return;
        }
        const sameAisle = (other: CatalogProduct): boolean =>
            product.categoryId
                ? other.categoryId === product.categoryId
                : !!product.categoryLabel &&
                  other.categoryLabel === product.categoryLabel;
        this._related.set(
            listing
                .filter(
                    (other) =>
                        other.id !== product.id &&
                        this.canOrder(other) &&
                        sameAisle(other)
                )
                .slice(0, RELATED_LIMIT)
        );
    }

    /**
     * Map a listing onto the shared tile's view model — the same tile the
     * catalog grid renders, so the rail cannot drift from the board it links
     * back to.
     */
    private _toCard(product: CatalogProduct): ProductCardVm {
        const unit =
            product.unitShort || (this.isVi() ? product.unit : product.unitEn);
        const category =
            this.categoryName(product.categoryId) || product.categoryLabel;
        const fallback = categoryVisual(category);
        return {
            id: product.id,
            name: this.isVi() ? product.name : product.nameEn,
            thumbnail: product.thumbnail,
            imageUrl: product.imageUrl || product.thumbnail,
            emoji: fallback.emoji,
            thumbTint: fallback.thumbTint,
            price: this.formatPrice(product.price),
            priceUnit: unit || undefined,
            meta: product.marketSource || undefined,
            updatedNote:
                formatRelativeTime(product.updatedAt, this._lang()) ??
                undefined,
            badge: product.featured
                ? this._translocoService.translate('productCard.featured')
                : undefined,
            badgeClass: product.featured
                ? 'ff-product-card__badge--featured'
                : undefined,
            stock: product.quantity,
            stockUnit: unit || undefined,
            packWeightKg: product.packWeightKg,
            favorite: this.isFavorite(product),
            link: ['/catalog', product.productId],
        };
    }
}
