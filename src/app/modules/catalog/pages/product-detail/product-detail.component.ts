import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { CatalogService } from '../../catalog.service';

@Component({
    selector: 'product-detail',
    templateUrl: './product-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatButtonModule, MatIconModule, RouterLink, TranslocoModule],
})
export class ProductDetailComponent {
    private _catalogService = inject(CatalogService);
    private _translocoService = inject(TranslocoService);

    readonly product = this._catalogService.product;
    readonly categories = this._catalogService.categories;

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

    selectImage(index: number): void {
        this.selectedIndex.set(index);
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
}
