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
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { GuestGateService } from 'app/core/auth/guest-gate.service';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { formatRelativeTime } from 'app/core/util/relative-time';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { FavoritesService } from 'app/layout/common/favorites/favorites.service';
import { tagClass } from 'app/shared/tag-visual';
import { CatalogService } from '../../catalog.service';
import { CatalogProduct } from '../../catalog.types';

/** One row of the listing's spec table. */
interface ProductFact {
    labelKey: string;
    value: string;
}

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
        MatTooltipModule,
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
    readonly descriptionExpanded = signal(true);

    readonly isVi = computed(
        () => this._translocoService.getActiveLang() === 'vi'
    );

    /** Gallery images, falling back to the thumbnail when no images[] are set. */
    readonly galleryImages = computed<string[]>(() => {
        const product = this.product();
        if (!product) {
            return [];
        }
        return product.images?.length ? product.images : [product.thumbnail];
    });

    readonly mainImage = computed<string>(() => {
        const images = this.galleryImages();
        return images[this.selectedIndex()] ?? images[0] ?? '';
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

    /**
     * The listing's spec table — everything
     * `GET /markets/{id}/products` reports about this row that is not already
     * in the headline, in the order a buyer weighs it.
     *
     * Rows with no value are dropped rather than rendered as a dash: a listing
     * without a packing code should not show an empty "packing" line.
     */
    readonly facts = computed<ProductFact[]>(() => {
        const product = this.product();
        if (!product) {
            return [];
        }
        const lang = this._translocoService.getActiveLang();
        const rows: ProductFact[] = [];

        const unit = this.isVi() ? product.unit : product.unitEn;
        if (unit) {
            rows.push({ labelKey: 'catalog.unit', value: unit });
        }
        if (product.packWeightKg !== null && product.packWeightKg > 0) {
            rows.push({
                labelKey: 'catalog.detail.packing',
                value: `${product.packWeightKg.toLocaleString(lang)} kg`,
            });
        }
        if (product.marketSource) {
            rows.push({
                labelKey: 'catalog.marketSource',
                value: product.marketSource,
            });
        }
        const category =
            this.categoryName(product.categoryId) || product.categoryLabel;
        if (category) {
            rows.push({ labelKey: 'catalog.detail.category', value: category });
        }
        if (product.minimumOrderQuantity > 1) {
            rows.push({
                labelKey: 'catalog.detail.minimumOrder',
                value: `${product.minimumOrderQuantity.toLocaleString(lang)} ${this.unitShort()}`,
            });
        }
        // Only worth a row when it differs from what is orderable — otherwise
        // it repeats the stock figure already in the headline.
        if (
            product.totalQuantity !== null &&
            product.quantity !== null &&
            product.totalQuantity > product.quantity
        ) {
            rows.push({
                labelKey: 'catalog.detail.reserved',
                value: `${(product.totalQuantity - product.quantity).toLocaleString(lang)} ${this.unitShort()}`,
            });
        }
        return rows;
    });

    /** "2 giờ trước" — how long ago the market last restated this listing. */
    readonly updatedNote = computed(() =>
        formatRelativeTime(
            this.product()?.updatedAt,
            this._translocoService.getActiveLang()
        )
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
    }

    ngOnInit(): void {
        // Deep-linkable route — ensure favorites are loaded even if the
        // header trigger never rendered first.
        void this._favoritesService.ensureLoaded();
    }

    selectImage(index: number): void {
        this.selectedIndex.set(index);
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
     * Same draft-order entry point the catalog grid and wishlist use.
     *
     * `canOrder` is re-checked rather than trusted to the disabled button: this
     * page is reachable by link for a listing the board hides, and the stock it
     * judges on can fall under a case while the page is open.
     */
    addToDraftOrder(product: CatalogProduct): void {
        if (!this.canOrder(product) || !this._guestGate.requireAccount()) {
            return;
        }
        this._draftOrder.add(product);
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

    toggleDescription(): void {
        this.descriptionExpanded.update((expanded) => !expanded);
    }

    categoryName(categoryId: string): string {
        const cat = this.categories().find((c) => c.id === categoryId);
        if (!cat) {
            return '';
        }
        return this.isVi() ? cat.name : cat.nameEn;
    }

    formatPrice(price: number | null): string {
        if (price === null) {
            return '—';
        }
        return `${price.toLocaleString(this._translocoService.getActiveLang())} ₫`;
    }
}
