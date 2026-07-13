import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    inject,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ApprovalBannerComponent } from 'app/core/auth/components/approval-banner.component';
import { DraftOrderService } from 'app/layout/common/draft-order/draft-order.service';
import { FavoritesService } from 'app/layout/common/favorites/favorites.service';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CatalogService } from './catalog.service';
import { CatalogProduct } from './catalog.types';

type SortOption = '' | 'name-asc' | 'name-desc';
type ViewMode = 'grid' | 'list';

@Component({
    selector: 'catalog',
    templateUrl: './catalog.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatChipsModule,
        MatPaginatorModule,
        MatButtonModule,
        MatProgressBarModule,
        MatRadioModule,
        MatSelectModule,
        MatTooltipModule,
        ReactiveFormsModule,
        RouterLink,
        TranslocoModule,
        ApprovalBannerComponent,
    ],
})
export class CatalogComponent implements OnInit {
    private _catalogService = inject(CatalogService);
    private _translocoService = inject(TranslocoService);
    private _destroyRef = inject(DestroyRef);
    private _favoritesService = inject(FavoritesService);
    private _draftOrderService = inject(DraftOrderService);

    readonly searchControl = new FormControl('', { nonNullable: true });
    readonly selectedCategory = signal<string>('');
    readonly searchTerm = signal<string>('');
    readonly loading = signal(false);

    /** Client-side refinements (the products API has no such params yet). */
    readonly selectedMarket = signal<string>('');
    readonly sortOption = signal<SortOption>('');
    readonly viewMode = signal<ViewMode>('grid');

    readonly categories = this._catalogService.categories;
    readonly products = this._catalogService.products;
    readonly pagination = this._catalogService.pagination;

    readonly isVi = computed(
        () => this._translocoService.getActiveLang() === 'vi'
    );

    /** Distinct market sources on the current page (client-side filter). */
    readonly marketSources = computed(() => [
        ...new Set(
            this.products()
                .map((product) => product.marketSource)
                .filter(Boolean)
        ),
    ]);

    /** Page products after the client-side market filter + name sort. */
    readonly visibleProducts = computed(() => {
        const market = this.selectedMarket();
        const sort = this.sortOption();
        let items = this.products();
        if (market) {
            items = items.filter((product) => product.marketSource === market);
        }
        if (sort) {
            const direction = sort === 'name-asc' ? 1 : -1;
            items = [...items].sort(
                (a, b) =>
                    direction *
                    this.productName(a).localeCompare(this.productName(b), 'vi')
            );
        }
        return items;
    });

    readonly resultCount = computed(() =>
        this.selectedMarket()
            ? this.visibleProducts().length
            : this.pagination()?.length ?? 0
    );

    readonly hasActiveFilters = computed(
        () =>
            !!this.selectedCategory() ||
            !!this.searchTerm() ||
            !!this.selectedMarket()
    );

    ngOnInit(): void {
        this.searchControl.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                takeUntilDestroyed(this._destroyRef)
            )
            .subscribe((search) => {
                this.searchTerm.set(search);
                this._loadProducts({ search });
            });
    }

    filterByCategory(categoryId: string): void {
        this.selectedCategory.set(categoryId);
        this.selectedMarket.set('');
        this._loadProducts({ category: categoryId });
    }

    filterByMarket(source: string): void {
        this.selectedMarket.set(source);
    }

    setSort(option: SortOption): void {
        this.sortOption.set(option);
    }

    setViewMode(mode: ViewMode): void {
        this.viewMode.set(mode);
    }

    setPageSize(size: number): void {
        this._loadProducts({ page: 0, size });
    }

    clearSearch(): void {
        this.searchControl.setValue('', { emitEvent: false });
        this.searchTerm.set('');
        this._loadProducts({ search: '' });
    }

    clearFilters(): void {
        this.searchControl.setValue('', { emitEvent: false });
        this.searchTerm.set('');
        this.selectedCategory.set('');
        this.selectedMarket.set('');
        this._loadProducts({ search: '', category: '' });
    }

    onPageChange(event: PageEvent): void {
        this._loadProducts({ page: event.pageIndex, size: event.pageSize });
    }

    categoryName(categoryId: string): string {
        const cat = this.categories().find((c) => c.id === categoryId);
        if (!cat) {
            return '';
        }
        return this.isVi() ? cat.name : cat.nameEn;
    }

    productName(product: CatalogProduct): string {
        return this.isVi() ? product.name : product.nameEn;
    }

    isFavorite(productId: string): boolean {
        return this._favoritesService.isFavorite(productId);
    }

    toggleFavorite(product: CatalogProduct, event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this._favoritesService.toggle(product);
    }

    addToDraftOrder(product: CatalogProduct, event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this._draftOrderService.add(product);
    }

    private _loadProducts(
        overrides: {
            search?: string;
            category?: string;
            page?: number;
            size?: number;
        } = {}
    ): void {
        this.loading.set(true);
        const params = {
            search: overrides.search ?? this.searchControl.value,
            category: overrides.category ?? this.selectedCategory(),
            page: overrides.page ?? 0,
            size: overrides.size ?? this.pagination()?.size ?? 12,
        };

        this._catalogService
            .getProducts(params)
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe(() => this.loading.set(false));
    }
}
