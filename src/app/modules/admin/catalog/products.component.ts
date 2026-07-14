import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { CatalogAdminService } from './catalog-admin.service';

/** Admin ▸ Catalog ▸ Products — product master data (M3, admin = Full). */
@Component({
    selector: 'admin-products',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class ProductsComponent {
    private readonly _catalog = inject(CatalogAdminService);

    readonly resource: CrudResource = {
        title: 'admin.products.title',
        subtitle: 'admin.products.subtitle',
        createLabel: 'admin.products.create',
        searchKeys: ['name'],
        columns: [
            {
                label: 'admin.products.name',
                cell: (row) => String(row['name'] ?? ''),
            },
            {
                label: 'admin.products.category',
                cell: (row) => String(row['categoryName'] ?? ''),
            },
            {
                label: 'admin.products.unit',
                cell: (row) =>
                    String(row['unitName'] ?? row['unitAbbreviation'] ?? ''),
            },
        ],
        fields: [
            {
                name: 'name',
                label: 'admin.products.name',
                type: 'text',
                required: true,
            },
            {
                name: 'unitId',
                label: 'admin.products.unit',
                type: 'select',
                required: true,
                options: () => this._catalog.unitOptions(),
            },
            {
                name: 'categoryId',
                label: 'admin.products.category',
                type: 'select',
                options: () => this._catalog.categoryOptions(),
            },
            {
                name: 'description',
                label: 'admin.products.description',
                type: 'textarea',
            },
            {
                name: 'imageUrl',
                label: 'admin.products.imageUrl',
                type: 'text',
            },
        ],
        list: () => this._catalog.listProducts(),
        create: (value) => this._catalog.createProduct(value),
        update: (id, value) => this._catalog.updateProduct(id, value),
        remove: (row) => this._catalog.deactivateProduct(row.id),
        removeLabel: 'admin.crud.deactivate',
        removeIcon: 'archive-box-x-mark',
    };
}
