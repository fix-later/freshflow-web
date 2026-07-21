import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
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
    private readonly _transloco = inject(TranslocoService);

    readonly resource: CrudResource = {
        title: 'admin.products.title',
        subtitle: 'admin.products.subtitle',
        createLabel: 'admin.products.create',
        searchKeys: ['name'],
        searchPlaceholder: 'admin.products.searchPlaceholder',
        filters: [
            {
                name: 'categoryId',
                label: 'admin.products.filterCategory',
                // Only offer categories that are still active.
                options: () => this._catalog.categoryOptions(true),
                match: (row, value) => String(row['categoryId']) === value,
            },
            {
                name: 'status',
                label: 'admin.products.filterStatus',
                options: () =>
                    Promise.resolve([
                        {
                            value: 'active',
                            label: this._transloco.translate(
                                'admin.users.filters.active'
                            ),
                        },
                        {
                            value: 'inactive',
                            label: this._transloco.translate(
                                'admin.users.filters.inactive'
                            ),
                        },
                    ]),
                match: (row, value) =>
                    value === 'active'
                        ? row.isActive !== false
                        : row.isActive === false,
            },
        ],
        columns: [
            {
                label: 'admin.products.image',
                image: true,
                cell: (row) => String(row['imageUrl'] ?? ''),
            },
            {
                label: 'admin.products.name',
                sortable: true,
                cell: (row) => String(row['name'] ?? ''),
            },
            {
                label: 'admin.products.category',
                sortable: true,
                cell: (row) => String(row['categoryName'] ?? ''),
            },
            {
                label: 'admin.products.unit',
                sortable: true,
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
                searchable: true,
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
                type: 'image',
                // The create endpoint ignores imageUrl; only editing persists it.
                editOnly: true,
                upload: (file) => this._catalog.uploadProductImage(file),
            },
        ],
        list: () => this._catalog.listProducts(),
        create: (value) => this._catalog.createProduct(value),
        update: (id, value) => this._catalog.updateProduct(id, value),
        remove: (row) => this._catalog.deactivateProduct(row.id),
        removeLabel: 'admin.crud.deactivate',
        removeIsDeactivate: true,
        removeIcon: 'archive-box-x-mark',
    };
}
