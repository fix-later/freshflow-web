import { Router } from '@angular/router';
import {
    CrudFormValue,
    CrudResource,
    CrudRow,
} from '../shared/resource-crud.types';
import { LogisticsAdminService } from './logistics-admin.service';

/**
 * Share of a hub's capacity currently taken, or `null` when the hub declares no
 * capacity (nothing to be a share of). Same bands as the meter on the hub page,
 * so "sắp đầy" in the filter means what the amber bar means.
 */
function utilization(row: CrudRow): number | null {
    const capacity = Number(row['capacityKg'] ?? 0);
    if (!Number.isFinite(capacity) || capacity <= 0) {
        return null;
    }
    const occupied = Number(row['occupiedCapacityKg'] ?? 0);
    return (Number.isFinite(occupied) ? occupied : 0) / capacity;
}

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
    /**
     * Called after a hub is created. A chợ has exactly one, so its tab swaps
     * the create form for the hub itself the moment there is one.
     */
    onCreated?: () => void;
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
    label: (key: string) => string,
    options: HubResourceOptions = {}
): CrudResource {
    const { marketId, openDetail, onCreated } = options;

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
        // Only the standalone screen lists more than one hub; inside a chợ this
        // form is shown solely to create the one it lacks.
        // Not `managedByName`: who runs a hub is deliberately not on this
        // screen (see the column note below), and a search that quietly matches
        // on it would hand back the same association a column would.
        searchKeys: marketId ? undefined : ['name', 'address', 'marketName'],
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
        filters: marketId
            ? undefined
            : [
                  {
                      name: 'status',
                      label: 'admin.crud.status',
                      options: () =>
                          Promise.resolve([
                              {
                                  value: 'active',
                                  label: label('admin.crud.active'),
                              },
                              {
                                  value: 'inactive',
                                  label: label('admin.crud.inactive'),
                              },
                          ]),
                      match: (row, value) =>
                          value === 'active'
                              ? row['isActive'] !== false
                              : row['isActive'] === false,
                  },
                  {
                      name: 'utilization',
                      label: 'admin.hubs.utilizationPercent',
                      options: () =>
                          Promise.resolve([
                              {
                                  value: 'free',
                                  label: label('admin.hubs.utilization.free'),
                              },
                              {
                                  value: 'tight',
                                  label: label('admin.hubs.utilization.tight'),
                              },
                              {
                                  value: 'full',
                                  label: label('admin.hubs.utilization.full'),
                              },
                          ]),
                      match: (row, value) => {
                          const used = utilization(row);
                          if (used === null) {
                              return false;
                          }
                          if (value === 'full') {
                              return used >= 0.9;
                          }
                          return value === 'tight'
                              ? used >= 0.7 && used < 0.9
                              : used < 0.7;
                      },
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
        create: async (value) => {
            await logistics.createHub(withMarket(value));
            onCreated?.();
        },
        update: (id, value) => logistics.updateHub(id, withMarket(value)),
        remove: (row) => logistics.deleteHub(row.id),
        removeLabel: 'admin.crud.delete',
        removeIcon: 'trash',
    };
}
