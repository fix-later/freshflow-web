import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';

/** Admin ▸ Logistics ▸ Hubs — hub master data (M8, admin = Full). */
@Component({
    selector: 'admin-hubs',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class HubsComponent {
    private readonly _logistics = inject(LogisticsAdminService);

    readonly resource: CrudResource = {
        title: 'admin.hubs.title',
        subtitle: 'admin.hubs.subtitle',
        createLabel: 'admin.hubs.create',
        searchKeys: ['name', 'address'],
        columns: [
            {
                label: 'admin.hubs.name',
                cell: (row) => String(row['name'] ?? ''),
            },
            {
                label: 'admin.hubs.address',
                cell: (row) => String(row['address'] ?? ''),
            },
            {
                label: 'admin.hubs.capacityKg',
                cell: (row) => String(row['capacityKg'] ?? ''),
            },
        ],
        fields: [
            {
                name: 'name',
                label: 'admin.hubs.name',
                type: 'text',
                required: true,
            },
            { name: 'address', label: 'admin.hubs.address', type: 'text' },
            {
                name: 'capacityKg',
                label: 'admin.hubs.capacityKg',
                type: 'number',
            },
            {
                name: 'latitude',
                label: 'admin.markets.latitude',
                type: 'number',
            },
            {
                name: 'longitude',
                label: 'admin.markets.longitude',
                type: 'number',
            },
            { name: 'managedBy', label: 'admin.hubs.managedBy', type: 'text' },
        ],
        list: () => this._logistics.listHubs(),
        create: (value) => this._logistics.createHub(value),
        update: (id, value) => this._logistics.updateHub(id, value),
        remove: (row) => this._logistics.deleteHub(row.id),
        removeLabel: 'admin.crud.delete',
        removeIcon: 'trash',
    };
}
