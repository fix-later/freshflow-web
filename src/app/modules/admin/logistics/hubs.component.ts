import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { Router } from '@angular/router';
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
    private readonly _router = inject(Router);

    readonly resource: CrudResource = {
        title: 'admin.hubs.title',
        subtitle: 'admin.hubs.subtitle',
        createLabel: 'admin.hubs.create',
        searchKeys: ['name', 'address', 'managedByName'],
        searchPlaceholder: 'admin.hubs.searchPlaceholder',
        columns: [
            {
                label: 'admin.hubs.name',
                sortable: true,
                cell: (row) => String(row['name'] ?? ''),
            },
            {
                label: 'admin.hubs.address',
                sortable: true,
                cell: (row) => String(row['address'] ?? ''),
            },
            {
                label: 'admin.hubs.capacityKg',
                sortable: true,
                // `cell` renders "500 kg"; sort on the bare number.
                sortValue: (row) =>
                    row['capacityKg'] == null || row['capacityKg'] === ''
                        ? null
                        : Number(row['capacityKg']),
                cell: (row) =>
                    row['capacityKg'] != null && row['capacityKg'] !== ''
                        ? `${row['capacityKg']} kg`
                        : '',
            },
            {
                label: 'admin.hubs.coordinates',
                cell: (row) =>
                    row['latitude'] != null && row['longitude'] != null
                        ? `${row['latitude']}, ${row['longitude']}`
                        : '',
            },
            {
                label: 'admin.hubs.managedBy',
                sortable: true,
                cell: (row) => String(row['managedByName'] ?? ''),
            },
        ],
        fields: [
            {
                name: 'name',
                label: 'admin.hubs.name',
                type: 'text',
                required: true,
                maxLength: 200,
            },
            {
                name: 'address',
                label: 'admin.hubs.address',
                type: 'text',
                maxLength: 500,
            },
            {
                name: 'capacityKg',
                label: 'admin.hubs.capacityKg',
                type: 'number',
                required: true,
                min: 1,
            },
            {
                name: 'managedBy',
                label: 'admin.hubs.managedBy',
                type: 'select',
                options: () => this._logistics.hubManagerOptions(),
            },
            {
                name: 'location',
                label: 'admin.hubs.coordinates',
                type: 'location',
                latField: 'latitude',
                lngField: 'longitude',
            },
        ],
        list: () => this._logistics.listHubs(),
        create: (value) => this._logistics.createHub(value),
        update: (id, value) => this._logistics.updateHub(id, value),
        remove: (row) => this._logistics.deleteHub(row.id),
        removeLabel: 'admin.crud.delete',
        removeIcon: 'trash',
        rowActions: [
            {
                icon: 'user-group',
                tooltip: 'admin.hubStaff.manage',
                run: (row) =>
                    void this._router.navigate(
                        ['/admin/hubs', row.id, 'staff'],
                        { state: { hubName: String(row['name'] ?? '') } }
                    ),
            },
        ],
    };
}
