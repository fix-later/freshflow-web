import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';

/** Admin ▸ Logistics ▸ Delivery Zones — zone master data (M9, admin = Full). */
@Component({
    selector: 'admin-delivery-zones',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class DeliveryZonesComponent {
    private readonly _logistics = inject(LogisticsAdminService);

    readonly resource: CrudResource = {
        title: 'admin.zones.title',
        subtitle: 'admin.zones.subtitle',
        createLabel: 'admin.zones.create',
        searchKeys: ['code', 'name'],
        searchPlaceholder: 'admin.zones.searchPlaceholder',
        columns: [
            {
                label: 'admin.zones.code',
                sortable: true,
                cell: (row) => String(row['code'] ?? ''),
            },
            {
                label: 'admin.zones.name',
                sortable: true,
                cell: (row) => String(row['name'] ?? ''),
            },
        ],
        fields: [
            {
                name: 'code',
                label: 'admin.zones.code',
                type: 'text',
                required: true,
                createOnly: true,
            },
            {
                name: 'name',
                label: 'admin.zones.name',
                type: 'text',
                required: true,
            },
            {
                name: 'description',
                label: 'admin.zones.description',
                type: 'textarea',
            },
        ],
        list: () => this._logistics.listZones(),
        listPage: (query) => this._logistics.listZonesPage(query),
        create: (value) => this._logistics.createZone(value),
        update: (id, value) => this._logistics.updateZone(id, value),
        remove: (row) => this._logistics.deleteZone(row.id),
        removeLabel: 'admin.crud.delete',
        removeIcon: 'trash',
    };
}
