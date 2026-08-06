import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { ResourceCrudComponent } from '../shared/resource-crud.component';
import { CrudResource, CrudRow } from '../shared/resource-crud.types';
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
        // A hub has more than master data behind it — staff assignments and the
        // inbound/discrepancy oversight panel — so the row opens the hub page
        // instead of the inline edit panel the other CRUD screens use.
        openDetail: (row) => {
            void this._router.navigate(['/admin/hubs', row.id]);
        },
        subtitle: 'admin.hubs.subtitle',
        createLabel: 'admin.hubs.create',
        searchKeys: ['name', 'address', 'managedByName', 'marketName'],
        searchPlaceholder: 'admin.hubs.searchPlaceholder',
        columns: [
            {
                label: 'admin.hubs.name',
                sortable: true,
                width: 'minmax(0, 1.2fr)',
                cell: (row) => String(row['name'] ?? ''),
            },
            {
                label: 'admin.hubs.market',
                sortable: true,
                width: 'minmax(0, 1fr)',
                cell: (row) => String(row['marketName'] ?? ''),
            },
            {
                label: 'admin.hubs.address',
                sortable: true,
                width: 'minmax(0, 1.4fr)',
                cell: (row) => String(row['address'] ?? ''),
            },
            {
                label: 'admin.hubs.capacityKg',
                sortable: true,
                width: '7.5rem',
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
                label: 'admin.hubs.managedBy',
                sortable: true,
                width: 'minmax(0, 1fr)',
                cell: (row) => String(row['managedByName'] ?? ''),
                // Same assignable-user button + dialog as markets' agent.
                assign: {
                    idKey: 'managedBy',
                    noneLabel: 'admin.hubs.managerNone',
                    dialogTitle: 'admin.hubs.managerDialog.title',
                    dialogCurrent: 'admin.hubs.managerDialog.current',
                    dialogSelect: 'admin.hubs.managerDialog.select',
                    dialogClear: 'admin.hubs.managerDialog.clear',
                    dialogSave: 'admin.hubs.managerDialog.save',
                    dialogSuccess: 'admin.hubs.managerDialog.success',
                    dialogError: 'admin.hubs.managerDialog.error',
                    options: () => this._logistics.hubManagerOptions(),
                    save: (row, userId) => this._saveManager(row, userId),
                },
            },
        ],
        fields: [
            {
                name: 'marketId',
                label: 'admin.hubs.market',
                type: 'select',
                required: true,
                searchable: true,
                options: () => this._logistics.marketOptions(),
            },
            {
                name: 'name',
                label: 'admin.hubs.name',
                type: 'text',
                required: true,
                maxLength: 200,
            },
            {
                name: 'capacityKg',
                label: 'admin.hubs.capacityKg',
                type: 'number',
                required: true,
                min: 1,
            },
            {
                // One address search input → writes address + lat/lng (markets pattern).
                name: 'location',
                label: 'admin.hubs.address',
                type: 'location',
                // `CreateHubCommandValidator.Address` — `MaximumLength(500)`.
                maxLength: 500,
                latField: 'latitude',
                lngField: 'longitude',
                addressField: 'address',
            },
        ],
        list: () => this._logistics.listHubs(),
        create: (value) => this._logistics.createHub(value),
        update: (id, value) => this._logistics.updateHub(id, value),
        remove: (row) => this._logistics.deleteHub(row.id),
        removeLabel: 'admin.crud.delete',
        removeIcon: 'trash',
    };

    /** PATCH managedBy while keeping the rest of the hub payload intact. */
    private _saveManager(row: CrudRow, userId: string | null): Promise<void> {
        return this._logistics.updateHub(row.id, {
            name: String(row['name'] ?? ''),
            address:
                row['address'] == null || row['address'] === ''
                    ? null
                    : String(row['address']),
            latitude:
                row['latitude'] == null || row['latitude'] === ''
                    ? null
                    : Number(row['latitude']),
            longitude:
                row['longitude'] == null || row['longitude'] === ''
                    ? null
                    : Number(row['longitude']),
            capacityKg:
                row['capacityKg'] == null || row['capacityKg'] === ''
                    ? null
                    : Number(row['capacityKg']),
            managedBy: userId,
        });
    }
}
