import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
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

    readonly isVi = computed(
        () => this._translocoService.getActiveLang() === 'vi'
    );

    categoryName(categoryId: string): string {
        const cat = this.categories().find((c) => c.id === categoryId);
        if (!cat) {
            return '';
        }
        return this.isVi() ? cat.name : cat.nameEn;
    }
}
