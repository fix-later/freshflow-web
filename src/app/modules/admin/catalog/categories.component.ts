import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { CatalogAdminService } from './catalog-admin.service';

/** Admin ▸ Catalog ▸ Categories — product category master data (M3, admin = Full). */
@Component({
    selector: 'admin-categories',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class CategoriesComponent {
    private readonly _catalog = inject(CatalogAdminService);

    readonly resource: CrudResource = {
        title: 'admin.categories.title',
        subtitle: 'admin.categories.subtitle',
        createLabel: 'admin.categories.create',
        searchKeys: ['name'],
        columns: [
            {
                label: 'admin.categories.name',
                cell: (row) => String(row['name'] ?? ''),
            },
        ],
        fields: [
            {
                name: 'name',
                label: 'admin.categories.name',
                type: 'text',
                required: true,
            },
        ],
        list: () => this._catalog.listCategories(),
        create: (value) => this._catalog.createCategory(value),
        update: (id, value) => this._catalog.updateCategory(id, value),
        remove: (row) => this._catalog.deactivateCategory(row.id),
        removeLabel: 'admin.crud.deactivate',
        removeIcon: 'archive-box-x-mark',
    };
}
