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
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CatalogService } from './catalog.service';

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
        ReactiveFormsModule,
        RouterLink,
        TranslocoModule,
    ],
})
export class CatalogComponent implements OnInit {
    private _catalogService = inject(CatalogService);
    private _translocoService = inject(TranslocoService);
    private _destroyRef = inject(DestroyRef);

    readonly searchControl = new FormControl('', { nonNullable: true });
    readonly selectedCategory = signal<string>('');
    readonly searchTerm = signal<string>('');
    readonly loading = signal(false);

    readonly categories = this._catalogService.categories;
    readonly products = this._catalogService.products;
    readonly pagination = this._catalogService.pagination;

    readonly isVi = computed(
        () => this._translocoService.getActiveLang() === 'vi'
    );

    readonly hasActiveFilters = computed(
        () => !!this.selectedCategory() || !!this.searchTerm()
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
        this._loadProducts({ category: categoryId });
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

    productName(product: { name: string; nameEn: string }): string {
        return this.isVi() ? product.name : product.nameEn;
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
