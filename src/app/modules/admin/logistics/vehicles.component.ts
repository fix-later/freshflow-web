import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';

/** Admin ▸ Logistics ▸ Vehicles — fleet master data (M9, admin = Full). */
@Component({
    selector: 'admin-vehicles',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ResourceCrudComponent],
    template: `<admin-resource-crud
        [resource]="resource"
    ></admin-resource-crud>`,
})
export class VehiclesComponent {
    private readonly _logistics = inject(LogisticsAdminService);

    readonly resource: CrudResource = {
        title: 'admin.vehicles.title',
        subtitle: 'admin.vehicles.subtitle',
        createLabel: 'admin.vehicles.create',
        searchKeys: ['plateNumber', 'vehicleType'],
        columns: [
            {
                label: 'admin.vehicles.plateNumber',
                cell: (row) => String(row['plateNumber'] ?? ''),
            },
            {
                label: 'admin.vehicles.vehicleType',
                cell: (row) => String(row['vehicleType'] ?? ''),
            },
            {
                label: 'admin.vehicles.capacityKg',
                cell: (row) => String(row['capacityKg'] ?? ''),
            },
        ],
        fields: [
            {
                name: 'plateNumber',
                label: 'admin.vehicles.plateNumber',
                type: 'text',
                required: true,
            },
            {
                name: 'vehicleType',
                label: 'admin.vehicles.vehicleType',
                type: 'text',
            },
            {
                name: 'capacityKg',
                label: 'admin.vehicles.capacityKg',
                type: 'number',
            },
        ],
        list: () => this._logistics.listVehicles(),
        create: (value) => this._logistics.createVehicle(value),
        update: (id, value) => this._logistics.updateVehicle(id, value),
        remove: (row) => this._logistics.deleteVehicle(row.id),
        removeLabel: 'admin.crud.delete',
        removeIcon: 'trash',
    };
}
