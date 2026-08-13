import { Router } from '@angular/router';
import { AdminService } from '../admin.service';
import {
    CrudFormValue,
    CrudResource,
    CrudRow,
} from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';

/** Enough rows to cover a hub-staff roster of any realistic size. */
const STAFF_PAGE_SIZE = 200;

interface HubResourceOptions {
    /**
     * Scopes the list to one market and pins new hubs to it, for the market
     * detail page's hub tab. Omitted on the standalone hubs screen, which shows
     * every hub and asks which market each belongs to.
     */
    marketId?: string;
    /**
     * When given, each row is enriched with its full staff roster so the table
     * can name everyone assigned, not just the manager. Costs one request per
     * hub, which is why it is opt-in — the market tab lists a handful.
     */
    admin?: AdminService;
}

/**
 * The hub CRUD definition, shared by the standalone hubs screen and the market
 * detail page's hub tab, so the two cannot drift in columns, fields or limits.
 *
 * A row opens the hub page rather than the inline edit panel: a hub has more
 * behind it than master data — the staff roster and the inbound/discrepancy
 * oversight — and that is where staff are assigned.
 */
export function createHubResource(
    logistics: LogisticsAdminService,
    router: Router,
    options: HubResourceOptions = {}
): CrudResource {
    const { marketId, admin } = options;

    /**
     * Resolves every hub's staff ids to accounts, in one pass: the roster call
     * is per hub, but the account lookup is shared across them.
     */
    const withStaffNames = async (rows: CrudRow[]): Promise<CrudRow[]> => {
        if (!admin) {
            return rows;
        }
        const people = await admin
            .getUsers({ role: 'hub_staff', pageSize: STAFF_PAGE_SIZE })
            .then((page) => page.users)
            .catch(() => []);
        const nameById = new Map<string, string>(
            people.map((person): [string, string] => [
                person.id,
                person.email || String(person['name'] ?? person.id),
            ])
        );
        return Promise.all(
            rows.map(async (row) => ({
                ...row,
                staffNames: (
                    await logistics
                        .getHubStaffAssignments(row.id)
                        .catch(() => [])
                )
                    .map((id) => nameById.get(id) ?? id)
                    .join(', '),
            }))
        );
    };

    /** PATCH managedBy while keeping the rest of the hub payload intact. */
    const saveManager = (row: CrudRow, userId: string | null): Promise<void> =>
        logistics.updateHub(row.id, {
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
            marketId: row['marketId'] == null ? null : String(row['marketId']),
        });

    /** Scoped forms carry the market implicitly; the field is dropped. */
    const withMarket = (value: CrudFormValue): CrudFormValue =>
        marketId ? { ...value, marketId } : value;

    return {
        title: 'admin.hubs.title',
        openDetail: (row) => {
            void router.navigate(['/admin/hubs', row.id]);
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
            ...(marketId
                ? []
                : [
                      {
                          label: 'admin.hubs.market',
                          sortable: true,
                          width: 'minmax(0, 1fr)',
                          cell: (row: CrudRow) =>
                              String(row['marketName'] ?? ''),
                      },
                  ]),
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
            ...(admin
                ? [
                      {
                          label: 'admin.markets.editPage.hubs.staff',
                          sortable: true,
                          width: 'minmax(0, 1.2fr)',
                          cell: (row: CrudRow) =>
                              String(row['staffNames'] ?? ''),
                      },
                  ]
                : []),
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
                    options: () => logistics.hubManagerOptions(),
                    save: (row, userId) => saveManager(row, userId),
                },
            },
        ],
        fields: [
            ...(marketId
                ? []
                : [
                      {
                          name: 'marketId',
                          label: 'admin.hubs.market',
                          type: 'select' as const,
                          required: true,
                          searchable: true,
                          options: () => logistics.marketOptions(),
                      },
                  ]),
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
        list: async () => {
            const all = await logistics.listHubs();
            const rows = marketId
                ? all.filter(
                      (row) => String(row['marketId'] ?? '') === marketId
                  )
                : all;
            return withStaffNames(rows);
        },
        create: (value) => logistics.createHub(withMarket(value)),
        update: (id, value) => logistics.updateHub(id, withMarket(value)),
        remove: (row) => logistics.deleteHub(row.id),
        removeLabel: 'admin.crud.delete',
        removeIcon: 'trash',
    };
}
