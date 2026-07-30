import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';

/** Types the backend accepts (`VehicleType`); anything else is rejected 400. */
const VEHICLE_TYPES = ['van', 'truck', 'motorbike'];

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
    private readonly _transloco = inject(TranslocoService);

    /** Cells and filter options are rendered verbatim — translate them here. */
    private _label(key: string): string {
        return this._transloco.translate(key);
    }

    readonly resource: CrudResource = {
        title: 'admin.vehicles.title',
        subtitle: 'admin.vehicles.subtitle',
        createLabel: 'admin.vehicles.create',
        searchKeys: ['plateNumber', 'vehicleType'],
        searchPlaceholder: 'admin.vehicles.searchPlaceholder',
        columns: [
            {
                label: 'admin.vehicles.plateNumber',
                sortable: true,
                cell: (row) => String(row['plateNumber'] ?? ''),
            },
            {
                label: 'admin.vehicles.vehicleType',
                sortable: true,
                cell: (row) => String(row['vehicleType'] ?? ''),
            },
            {
                label: 'admin.vehicles.capacityKg',
                sortable: true,
                sortValue: (row) =>
                    row['capacityKg'] == null || row['capacityKg'] === ''
                        ? null
                        : Number(row['capacityKg']),
                cell: (row) => String(row['capacityKg'] ?? ''),
            },
            {
                label: 'admin.vehicles.availability',
                width: '9rem',
                sortable: true,
                cell: (row) =>
                    this._label(
                        row['isAvailable'] === false
                            ? 'admin.vehicles.unavailable'
                            : 'admin.vehicles.available'
                    ),
            },
        ],
        fields: [
            {
                name: 'plateNumber',
                label: 'admin.vehicles.plateNumber',
                type: 'text',
                required: true,
                maxLength: 20,
            },
            {
                name: 'vehicleType',
                label: 'admin.vehicles.vehicleType',
                type: 'select',
                required: true,
                options: () =>
                    Promise.resolve(
                        VEHICLE_TYPES.map((value) => ({
                            value,
                            label: value,
                        }))
                    ),
            },
            {
                name: 'capacityKg',
                label: 'admin.vehicles.capacityKg',
                type: 'number',
                required: true,
                min: 1,
            },
        ],
        filters: [
            {
                name: 'availability',
                label: 'admin.vehicles.availability',
                options: () =>
                    Promise.resolve([
                        {
                            value: 'available',
                            label: this._label('admin.vehicles.available'),
                        },
                        {
                            value: 'unavailable',
                            label: this._label('admin.vehicles.unavailable'),
                        },
                    ]),
                match: (row, value) =>
                    value === 'available'
                        ? row['isAvailable'] !== false
                        : row['isAvailable'] === false,
            },
        ],
        list: () => this._logistics.listVehicles(),
        create: (value) => this._logistics.createVehicle(value),
        update: (id, value) => this._logistics.updateVehicle(id, value),
        // The backend soft-deletes (`DeactivateVehicle`) and offers no undo.
        remove: (row) => this._logistics.deleteVehicle(row.id),
        removeLabel: 'admin.crud.deactivate',
        removeIsDeactivate: true,
        removeIcon: 'trash',
    };
}
