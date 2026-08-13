import { Router } from '@angular/router';
import {
    CrudFormValue,
    CrudResource,
    CrudRow,
} from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';

interface HubResourceOptions {
    /**
     * Scopes the list to one market and pins new hubs to it, for the market
     * detail page's hub tab. Omitted on the standalone hubs screen, which shows
     * every hub and asks which market each belongs to.
     */
    marketId?: string;
    /**
     * Handles a row click instead of routing to the hub's own page. The market
     * tab uses it to open the hub in place, keeping the chợ page and its tabs
     * on screen.
     */
    openDetail?: (hubId: string) => void;
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
    const { marketId, openDetail } = options;

    /** Scoped forms carry the market implicitly; the field is dropped. */
    const withMarket = (value: CrudFormValue): CrudFormValue =>
        marketId ? { ...value, marketId } : value;

    return {
        title: 'admin.hubs.title',
        openDetail: (row) => {
            if (openDetail) {
                openDetail(row.id);
                return;
            }
            void router.navigate(['/admin/hubs', row.id]);
        },
        subtitle: 'admin.hubs.subtitle',
        createLabel: 'admin.hubs.create',
        searchKeys: ['name', 'address', 'managedByName', 'marketName'],
        searchPlaceholder: 'admin.hubs.searchPlaceholder',
        // Name and capacity are sized to their content — a hub name is a couple
        // of words, a capacity never longer than "1.000 kg" — so the room goes
        // to chợ and address, which actually use it.
        columns: [
            {
                label: 'admin.hubs.name',
                sortable: true,
                width: '14rem',
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
                width: 'minmax(0, 1fr)',
                cell: (row) => String(row['address'] ?? ''),
            },
            {
                label: 'admin.hubs.capacityKg',
                sortable: true,
                width: '9rem',
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
            // The manager column is off the table: a hub's people are the staff
            // roster, and a second "who runs it" field next to it only invited
            // the question of which one matters. `managedBy` is still stored and
            // still round-tripped on save — only its UI is gone.
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
            return marketId
                ? all.filter(
                      (row) => String(row['marketId'] ?? '') === marketId
                  )
                : all;
        },
        create: (value) => logistics.createHub(withMarket(value)),
        update: (id, value) => logistics.updateHub(id, withMarket(value)),
        remove: (row) => logistics.deleteHub(row.id),
        removeLabel: 'admin.crud.delete',
        removeIcon: 'trash',
    };
}
