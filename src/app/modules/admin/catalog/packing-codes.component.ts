import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { CatalogAdminService } from './catalog-admin.service';

/**
 * Admin ▸ Catalog ▸ Packing codes — box/crate size codes used to pack
 * procurement items for hand-off (M3, admin = Full).
 */
@Component({
    selector: 'admin-packing-codes',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class PackingCodesComponent {
    private readonly _catalog = inject(CatalogAdminService);

    readonly resource: CrudResource = {
        title: 'admin.packingCodes.title',
        subtitle: 'admin.packingCodes.subtitle',
        createLabel: 'admin.packingCodes.create',
        inlineDetail: false,
        searchKeys: ['code', 'description'],
        searchPlaceholder: 'admin.packingCodes.searchPlaceholder',
        columns: [
            {
                label: 'admin.packingCodes.code',
                sortable: true,
                cell: (row) => String(row['code'] ?? ''),
            },
            {
                label: 'admin.packingCodes.description',
                sortable: true,
                cell: (row) => String(row['description'] ?? ''),
            },
            {
                label: 'admin.packingCodes.capacityKg',
                sortable: true,
                sortValue: (row) => Number(row['capacityKg'] ?? 0),
                cell: (row) =>
                    row['capacityKg'] != null ? `${row['capacityKg']} kg` : '',
            },
        ],
        fields: [
            {
                name: 'code',
                label: 'admin.packingCodes.code',
                type: 'text',
                required: true,
                maxLength: 50,
            },
            {
                name: 'capacityKg',
                label: 'admin.packingCodes.capacityKg',
                type: 'number',
            },
            {
                name: 'description',
                label: 'admin.packingCodes.description',
                type: 'textarea',
            },
        ],
        list: () => this._catalog.listPackingCodes(),
        create: (value) => this._catalog.createPackingCode(value),
        update: (id, value) => this._catalog.updatePackingCode(id, value),
        remove: (row) => this._catalog.deactivatePackingCode(row.id),
        removeLabel: 'admin.crud.deactivate',
        removeIsDeactivate: true,
        removeIcon: 'archive-box-x-mark',
    };
}
