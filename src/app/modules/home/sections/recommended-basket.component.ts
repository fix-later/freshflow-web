import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
    signal,
    untracked,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { activeLang, formatVnd } from 'app/core/i18n/active-lang';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { CatalogService } from 'app/modules/catalog/catalog.service';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { BasketLine, RecommendedBasket } from '../storefront-landing.types';
import { StorefrontStubService } from '../storefront-stub.service';

/**
 * Section 5: "Mọi người thường mua".
 *
 * A basket the buyer edits and adds in one action, instead of running eight
 * separate searches. This is the page's biggest lever on order value.
 *
 * Two guarantees hold by construction rather than by a check that could be
 * forgotten:
 *
 * 1. **A line can only enter an order if a real listing backs it.** Basket
 *    contents are stub data (see `StorefrontStubService`), resolved by name
 *    against the selected market's real listings. An unresolved member gets
 *    `product: null`, which makes `available` false, which excludes it from
 *    the add. Stub data therefore cannot put a fake product or a fake price
 *    into a real order.
 * 2. **Unavailable lines are shown, not hidden.** The buyer should learn that
 *    this market does not carry an ingredient, rather than silently receiving
 *    a shorter basket than the one they were shown.
 */
@Component({
    selector: 'recommended-basket',
    templateUrl: './recommended-basket.component.html',
    styleUrls: ['./recommended-basket.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatIconModule,
        MatProgressSpinnerModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class RecommendedBasketComponent {
    private _stub = inject(StorefrontStubService);
    private _catalog = inject(CatalogService);
    private _markets = inject(MarketSelectionService);
    private _draftOrder = inject(DraftOrderService);

    /** Set by section 6 through the shell when a kitchen type is chosen. */
    readonly businessKindId = input<string | null>(null);

    private readonly _lang = activeLang();
    readonly isVi = computed(() => this._lang() === 'vi');

    readonly market = this._markets.selected;
    readonly loading = signal(false);
    readonly baskets = this._stub.baskets();

    private readonly _chosenId = signal<string | null>(null);
    private readonly _products = signal<CatalogProduct[]>([]);
    /** Buyer edits, keyed by line label so they survive a re-resolve. */
    private readonly _edits = signal<
        ReadonlyMap<string, { quantity: number; included: boolean }>
    >(new Map());

    readonly basket = computed<RecommendedBasket | null>(() => {
        const explicit = this._chosenId();
        if (explicit) {
            return (
                this.baskets.find((candidate) => candidate.id === explicit) ??
                null
            );
        }
        const fromKind = this.businessKindId();
        if (fromKind) {
            return this._stub.basketFor(fromKind);
        }
        return this.baskets[0] ?? null;
    });

    readonly lines = computed<BasketLine[]>(() => {
        const basket = this.basket();
        if (!basket) {
            return [];
        }
        const edits = this._edits();
        return this._stub
            .resolveBasket(basket, this._products())
            .map((line) => {
                const edit = edits.get(line.label);
                if (!edit || !line.available) {
                    return line;
                }
                return {
                    ...line,
                    quantity: edit.quantity,
                    included: edit.included,
                };
            });
    });

    readonly addableCount = computed(
        () =>
            this.lines().filter((line) => line.included && line.available)
                .length
    );

    readonly unavailableCount = computed(
        () => this.lines().filter((line) => !line.available).length
    );

    /** Display-only total for the lines currently selected. */
    readonly estimatedTotal = computed(() =>
        formatVnd(
            this.lines()
                .filter((line) => line.included && line.available)
                .reduce(
                    (total, line) =>
                        total + (line.product?.price ?? 0) * line.quantity,
                    0
                ),
            this._lang()
        )
    );

    constructor() {
        void this._markets.ensureLoaded();

        effect(() => {
            const marketId = this._markets.selectedId();
            untracked(() => {
                this._products.set([]);
                this._edits.set(new Map());
                if (marketId) {
                    void this._load(marketId);
                }
            });
        });

        // Picking a kitchen type in section 6 overrides any basket chosen here,
        // so the two controls cannot disagree about what is on screen.
        effect(() => {
            const kindId = this.businessKindId();
            untracked(() => {
                if (kindId) {
                    this._chosenId.set(null);
                    this._edits.set(new Map());
                }
            });
        });
    }

    basketLabel(basket: RecommendedBasket): string {
        return this.isVi() ? basket.name : basket.nameEn;
    }

    lineName(line: BasketLine): string {
        if (!line.product) {
            return line.label;
        }
        return this.isVi() ? line.product.name : line.product.nameEn;
    }

    linePrice(line: BasketLine): string {
        return formatVnd(line.product?.price ?? null, this._lang());
    }

    lineUnit(line: BasketLine): string {
        if (!line.product) {
            return '';
        }
        return this.isVi() ? line.product.unit : line.product.unitEn;
    }

    chooseBasket(basketId: string): void {
        this._chosenId.set(basketId);
        this._edits.set(new Map());
    }

    isChosen(basketId: string): boolean {
        return this.basket()?.id === basketId;
    }

    toggleLine(line: BasketLine): void {
        if (!line.available) {
            return;
        }
        this._edit(line, { included: !line.included });
    }

    /** Clamped to the backend's own minimum, which it enforces at confirmation. */
    changeQuantity(line: BasketLine, delta: number): void {
        if (!line.available) {
            return;
        }
        const min = line.product?.minimumOrderQuantity ?? 1;
        this._edit(line, { quantity: Math.max(min, line.quantity + delta) });
    }

    addBasket(): void {
        for (const line of this.lines()) {
            if (line.included && line.available && line.product) {
                this._draftOrder.add(line.product, line.quantity);
            }
        }
    }

    private _edit(
        line: BasketLine,
        patch: Partial<{ quantity: number; included: boolean }>
    ): void {
        this._edits.update((edits) => {
            const next = new Map(edits);
            const current = next.get(line.label) ?? {
                quantity: line.quantity,
                included: line.included,
            };
            next.set(line.label, { ...current, ...patch });
            return next;
        });
    }

    private async _load(marketId: string): Promise<void> {
        this.loading.set(true);
        try {
            const products =
                await this._catalog.getMarketProductSample(marketId);
            if (marketId !== this._markets.selectedId()) {
                return;
            }
            this._products.set(products);
        } finally {
            this.loading.set(false);
        }
    }
}
