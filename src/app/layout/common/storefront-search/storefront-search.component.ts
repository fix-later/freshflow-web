import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { activeLang } from 'app/core/i18n/active-lang';
import { MarketSelectionService } from 'app/core/market/market-selection.service';
import { includesFolded } from 'app/core/util/text-search';
import { CatalogService } from 'app/modules/catalog/catalog.service';
import { CatalogProduct } from 'app/modules/catalog/catalog.types';
import { debounceTime } from 'rxjs';

/** Fuse's own `SearchComponent` defaults, kept so the box feels the same. */
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_LENGTH = 2;

/** Suggestions per group. A header panel is a shortcut, not a results page. */
const MAX_PRODUCTS = 6;
const MAX_CATEGORIES = 4;

/** One suggestion row. */
export interface SearchSuggestion {
    id: string;
    label: string;
    /** Second line — the market a listing comes from, or the aisle's size. */
    detail: string;
    link: unknown[];
    queryParams?: Record<string, string>;
}

/**
 * The header's catalogue search, built on Fuse's search pattern: a debounced
 * input backed by `mat-autocomplete`, results grouped under `mat-optgroup`
 * headers, an explicit "no results" row, and Escape to dismiss.
 *
 * **Where the suggestions come from.** Fuse's component posts every keystroke
 * to `api/common/search`. There is no such endpoint here, and there does not
 * need to be: `CatalogService` already holds the selected market's whole
 * listing in memory (it is fetched once and filtered client-side — the listing
 * endpoint can neither search nor count), so this filters that. No request per
 * keystroke, and the suggestions agree with the catalog grid by construction.
 *
 * **Enter is not the autocomplete.** Picking a suggestion opens that product;
 * pressing Enter — or the search button — goes to `/catalog?q=`, the full
 * result set. The old header box did neither: `searchQuery` was bound to
 * `ngModel` and read by nothing, so the control looked live and led nowhere.
 */
@Component({
    selector: 'storefront-search',
    templateUrl: './storefront-search.component.html',
    styleUrls: ['./storefront-search.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatAutocompleteModule,
        MatIconModule,
        MatOptionModule,
        ReactiveFormsModule,
        TranslocoModule,
    ],
})
export class StorefrontSearchComponent {
    private readonly _catalog = inject(CatalogService);
    private readonly _marketSelection = inject(MarketSelectionService);
    private readonly _router = inject(Router);
    private readonly _transloco = inject(TranslocoService);
    private readonly _destroyRef = inject(DestroyRef);

    private readonly _lang = activeLang();
    private readonly _isVi = computed(() => this._lang() === 'vi');

    readonly searchControl = new FormControl('', { nonNullable: true });

    /** The debounced term the panel reads — not the raw keystrokes. */
    private readonly _term = signal('');

    /**
     * The listing this box searches, read through `peekMarketListing` rather
     * than the shared `products` signal.
     *
     * The header renders on every route, and only the catalog page loads that
     * signal — searching it directly would answer "no results" on the landing
     * page for products the catalogue plainly has. Fetched lazily on the first
     * real term (a header must not crawl the catalogue on page load) and shared
     * with the grid's own crawl, so it costs nothing once that has run.
     */
    private readonly _listing = signal<CatalogProduct[]>([]);
    private _listingMarketId: string | null = null;

    /**
     * `null` until the term is long enough to search on, which is what keeps
     * the panel closed rather than flashing every product on the first letter.
     */
    readonly products = computed<SearchSuggestion[] | null>(() => {
        const term = this._term();
        if (term.length < SEARCH_MIN_LENGTH) {
            return null;
        }
        return this._listing()
            .filter(
                (product) =>
                    includesFolded(product.name, term) ||
                    includesFolded(product.nameEn, term)
            )
            .slice(0, MAX_PRODUCTS)
            .map((product) => this._productSuggestion(product));
    });

    readonly categories = computed<SearchSuggestion[] | null>(() => {
        const term = this._term();
        if (term.length < SEARCH_MIN_LENGTH) {
            return null;
        }
        return this._catalog
            .categories()
            .filter(
                (category) =>
                    includesFolded(category.name, term) ||
                    includesFolded(category.nameEn, term)
            )
            .slice(0, MAX_CATEGORIES)
            .map((category) => ({
                id: category.id,
                label: this._isVi() ? category.name : category.nameEn,
                detail: this._transloco.translate('search.groups.categories'),
                link: ['/catalog'],
                queryParams: { category: category.id },
            }));
    });

    /** True once a search ran and matched nothing in either group. */
    readonly noResults = computed(
        () =>
            this.products() !== null &&
            this.products()!.length === 0 &&
            (this.categories()?.length ?? 0) === 0
    );

    constructor() {
        this.searchControl.valueChanges
            .pipe(
                debounceTime(SEARCH_DEBOUNCE_MS),
                takeUntilDestroyed(this._destroyRef)
            )
            .subscribe((value) => {
                const term = value.trim();
                this._term.set(term);
                if (term.length >= SEARCH_MIN_LENGTH) {
                    void this._ensureListing();
                }
            });
    }

    /** Loads (once per market) the listing the suggestions are drawn from. */
    private async _ensureListing(): Promise<void> {
        const marketId = this._marketSelection.selectedId();
        if (!marketId || this._listingMarketId === marketId) {
            return;
        }
        // Claimed before awaiting, so a burst of keystrokes starts one load.
        this._listingMarketId = marketId;
        try {
            this._listing.set(await this._catalog.peekMarketListing(marketId));
        } catch {
            // Suggestions degrade to categories; Enter still reaches the
            // catalog, which reports the failure itself.
            this._listingMarketId = null;
            this._listing.set([]);
        }
    }

    /**
     * Escape clears and closes. Material closes its own panel first, so this
     * only has to deal with the input.
     */
    onKeydown(event: KeyboardEvent): void {
        if (event.code === 'Escape') {
            this.searchControl.setValue('');
            this._term.set('');
        }
    }

    /**
     * Enter / the button: the whole result set rather than one guess.
     * An empty box lands on the unfiltered catalog — "show me everything" is a
     * reasonable thing to mean by it, same as the landing hero's box.
     */
    submit(): void {
        const term = this.searchControl.value.trim();
        void this._router.navigate(['/catalog'], {
            queryParams: term ? { q: term } : {},
        });
    }

    /** Following a suggestion leaves the box clean for the next one. */
    onSuggestionPicked(suggestion: SearchSuggestion): void {
        this.searchControl.setValue('');
        this._term.set('');
        void this._router.navigate(suggestion.link, {
            queryParams: suggestion.queryParams,
        });
    }

    private _productSuggestion(product: CatalogProduct): SearchSuggestion {
        return {
            id: product.id,
            label: this._isVi() ? product.name : product.nameEn,
            detail: product.marketSource,
            link: ['/catalog', product.productId],
        };
    }
}
