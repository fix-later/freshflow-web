import { CrudResource, CrudRow } from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';

/** Types the backend accepts (`VehicleType`); anything else is rejected 400. */
const VEHICLE_TYPES = ['van', 'truck', 'motorbike'];

/** i18n key for a stored type; unknown values fall back to the raw string. */
function typeKey(value: string): string {
    return VEHICLE_TYPES.includes(value) ? `admin.vehicles.type.${value}` : '';
}

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

    /**
     * hubId → name for the hubs in scope. Doubles as the membership test for a
     * market's fleet: a vehicle is stationed at a hub, and a hub belongs to a
     * market, so "this market's vehicles" are the ones whose hub is in here.
     */
    const hubNames = async (): Promise<Map<string, string>> =>
        new Map(
            (await logistics.hubOptions(marketId)).map(
                (hub): [string, string] => [hub.value, hub.label]
            )
        );

    const typeLabel = (value: string): string => {
        const key = typeKey(value);
        return key ? label(key) : value;
    };

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
                cell: (row) => typeLabel(String(row['vehicleType'] ?? '')),
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
            // Which hub a vehicle sits at is editable from the cell itself: it
            // is the one field that changes without the vehicle changing, and
            // the API has an endpoint for exactly that move.
            {
                label: 'admin.vehicles.hub',
                width: 'minmax(0, 1fr)',
                sortable: true,
                cell: (row) => String(row['hubName'] ?? ''),
                assign: {
                    idKey: 'hubId',
                    icon: 'building-office-2',
                    noneLabel: 'admin.vehicles.hubNone',
                    rowLabel: (row) => String(row['plateNumber'] ?? ''),
                    dialogTitle: 'admin.vehicles.assignHub.title',
                    dialogCurrent: 'admin.vehicles.assignHub.current',
                    dialogSelect: 'admin.vehicles.hub',
                    dialogClear: 'admin.crud.clearFilters',
                    dialogSave: 'admin.crud.save',
                    dialogSuccess: 'admin.vehicles.assignHub.success',
                    dialogError: 'admin.vehicles.assignHub.error',
                    // `PUT /vehicles/{id}/hub` takes a hub id and nothing else,
                    // so there is no "unassign" to offer.
                    allowClear: false,
                    options: () => logistics.hubOptions(marketId),
                    save: (row, hubId) =>
                        hubId
                            ? logistics.assignVehicleToHub(row.id, hubId)
                            : Promise.resolve(),
                },
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
                            label: typeLabel(value),
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
                name: 'vehicleType',
                label: 'admin.vehicles.vehicleType',
                options: () =>
                    Promise.resolve(
                        VEHICLE_TYPES.map((value) => ({
                            value,
                            label: typeLabel(value),
                        }))
                    ),
                match: (row, value) =>
                    String(row['vehicleType'] ?? '') === value,
            },
            // Which hub a vehicle is parked at is the question a chợ asks of its
            // fleet; the standalone screen asks it across every hub.
            {
                name: 'hubId',
                label: 'admin.vehicles.hub',
                options: () => logistics.hubOptions(marketId),
                match: (row, value) => String(row['hubId'] ?? '') === value,
            },
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
            // `GET /vehicles?hub_id=` takes one hub, and a market can have
            // several, so the market's fleet is the union — fetched once and
            // filtered on the hub set. The names come along for the hub column,
            // which the rows carry only as an id.
            const [rows, names] = await Promise.all([
                logistics.listVehicles(),
                hubNames(),
            ]);
            const scoped = marketId
                ? rows.filter((row: CrudRow) =>
                      names.has(String(row['hubId'] ?? ''))
                  )
                : rows;
            return scoped.map((row: CrudRow) => ({
                ...row,
                hubName: names.get(String(row['hubId'] ?? '')) ?? '',
            }));
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
