import { CrudResource, CrudRow } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';

/** Types the backend accepts (`VehicleType`); anything else is rejected 400. */
const VEHICLE_TYPES = ['van', 'truck', 'motorbike'];

interface VehicleResourceOptions {
    /**
     * Scopes the fleet to one market: a vehicle is stationed at a hub, and a hub
     * belongs to a market, so "this market's vehicles" are the ones parked at
     * its hubs. The hub picker then offers only those hubs, and is required —
     * a vehicle added from a chợ with no hub to put it in would silently join
     * the unassigned pool.
     */
    marketId?: string;
}

/**
 * The vehicle CRUD definition, shared by the standalone vehicles screen and the
 * market detail page's vehicle tab.
 *
 * `label` translates the cells and filter options, which are rendered verbatim.
 */
export function createVehicleResource(
    logistics: LogisticsAdminService,
    label: (key: string) => string,
    options: VehicleResourceOptions = {}
): CrudResource {
    const { marketId } = options;

    /** Hub ids of this market — the set a scoped list is filtered to. */
    const marketHubIds = async (): Promise<Set<string>> =>
        new Set((await logistics.hubOptions(marketId)).map((hub) => hub.value));

    return {
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
                    label(
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
            {
                name: 'hubId',
                label: 'admin.vehicles.hub',
                type: 'select',
                searchable: true,
                // Required only when scoped: an unscoped fleet may legitimately
                // hold a vehicle that has not been stationed anywhere yet.
                required: !!marketId,
                options: () => logistics.hubOptions(marketId),
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
                            label: label('admin.vehicles.available'),
                        },
                        {
                            value: 'unavailable',
                            label: label('admin.vehicles.unavailable'),
                        },
                    ]),
                match: (row, value) =>
                    value === 'available'
                        ? row['isAvailable'] !== false
                        : row['isAvailable'] === false,
            },
        ],
        list: async () => {
            if (!marketId) {
                return logistics.listVehicles();
            }
            // `GET /vehicles?hub_id=` takes one hub, and a market can have
            // several, so the market's fleet is the union — fetched once and
            // filtered on the hub set.
            const hubIds = await marketHubIds();
            const rows = await logistics.listVehicles();
            return rows.filter((row: CrudRow) =>
                hubIds.has(String(row['hubId'] ?? ''))
            );
        },
        create: (value) => logistics.createVehicle(value),
        update: (id, value) => logistics.updateVehicle(id, value),
        // The backend soft-deletes (`DeactivateVehicle`) and offers no undo.
        remove: (row) => logistics.deleteVehicle(row.id),
        removeLabel: 'admin.crud.deactivate',
        removeIsDeactivate: true,
        removeIcon: 'trash',
    };
}
