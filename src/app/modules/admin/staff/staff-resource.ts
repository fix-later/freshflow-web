import { Router } from '@angular/router';
import { mapWithLimit } from 'app/core/util/concurrency';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { CrudResource, CrudRow } from '../shared/resource-crud.types';

/** The three roles that work a chợ or a hub. Restaurants are not staff. */
export const STAFF_ROLES = ['market_agent', 'hub_staff', 'driver'] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

const MARKET_AGENT: StaffRole = 'market_agent';
const HUB_STAFF: StaffRole = 'hub_staff';
const DRIVER: StaffRole = 'driver';

/** Hub rosters read at once. Paced for the same reason the agent reads are. */
const ROSTER_READ_CONCURRENCY = 6;

/**
 * One person on the roster, with everywhere they work.
 *
 * `places` is a list because the platform allows it: an agent can hold several
 * chợ, and someone can be on more than one hub's roster. Flattening it to "the"
 * chợ would quietly hide the second one — which is exactly the thing an
 * operations lead opens this page to find.
 */
export interface StaffRow extends CrudRow {
    email: string;
    phone: string;
    role: StaffRole;
    places: string[];
    placeLabel: string;
    isActive: boolean;
}

/**
 * Admin ▸ Quản trị ▸ Nhân sự — everyone working the chợ and the hubs, and
 * where.
 *
 * **Why this is not the Users page.** That one lists accounts by role and
 * settles what an account *is* (its role, whether it is switched on). This one
 * answers where each person actually works, which is stored nowhere in the user
 * record: an agent's chợ come from their market assignments, and hub staff and
 * drivers from each hub's roster. Neither list can be derived from the other.
 *
 * **Read-only, deliberately.** Assignment belongs to the place being staffed —
 * the chợ's Nhân sự tab, the hub's roster — where the whole team is visible at
 * once and the replace-the-set endpoints are safe to drive. Editing one row
 * from here would write the same endpoints with a view of one person. So a row
 * opens where they work instead, and there is no create button (there is no
 * such record to create: a staff account is created in Người dùng).
 *
 * No id column anywhere: an admin identifies a person by email and a place by
 * its name.
 */
/** A row's places, read back off the untyped `CrudRow` the table holds. */
function placesOf(row: CrudRow): string[] {
    const places = row['places'];
    return Array.isArray(places) ? (places as string[]) : [];
}

export function createStaffResource(
    admin: AdminService,
    logistics: LogisticsAdminService,
    router: Router,
    label: (key: string) => string
): CrudResource {
    const roleLabel = (role: string): string =>
        label(`admin.staff.role.${role}`);

    /** Where a row's first place is, so a click can go there. */
    const openPlace = (row: CrudRow): void => {
        const marketId = String(row['marketId'] ?? '');
        const hubId = String(row['hubId'] ?? '');
        if (marketId) {
            void router.navigate(['/admin/markets', marketId], {
                queryParams: { tab: 'staff' },
            });
            return;
        }
        if (hubId) {
            void router.navigate(['/admin/hubs', hubId]);
        }
    };

    return {
        title: 'admin.staff.title',
        subtitle: 'admin.staff.subtitle',
        // Never rendered — {@link CrudResource.create} is omitted — but the
        // shell reads it for the page heading in create mode.
        createLabel: 'admin.staff.title',
        searchKeys: ['email', 'phone', 'placeLabel'],
        searchPlaceholder: 'admin.staff.searchPlaceholder',
        columns: [
            {
                label: 'admin.staff.email',
                sortable: true,
                width: 'minmax(0, 1.2fr)',
                cell: (row) => String(row['email'] ?? ''),
            },
            {
                label: 'admin.staff.phone',
                sortable: true,
                width: '10rem',
                cell: (row) => String(row['phone'] ?? ''),
            },
            {
                label: 'admin.staff.role',
                sortable: true,
                width: '10rem',
                cell: (row) => roleLabel(String(row['role'] ?? '')),
            },
            {
                label: 'admin.staff.place',
                sortable: true,
                width: 'minmax(0, 1.4fr)',
                cell: (row) => String(row['placeLabel'] ?? ''),
            },
            // No status column: the table appends its own pill from `isActive`
            // after the declared ones, and a second one only asked which of the
            // two to believe.
        ],
        // Nothing is edited here, so the dialog has no fields to show.
        fields: [],
        filters: [
            {
                name: 'role',
                label: 'admin.staff.role',
                options: () =>
                    Promise.resolve(
                        STAFF_ROLES.map((role) => ({
                            value: role,
                            label: roleLabel(role),
                        }))
                    ),
                match: (row, value) => String(row['role'] ?? '') === value,
            },
            {
                // Built from the rows rather than from the chợ and hub lists:
                // this filter is for narrowing what is on screen, and a place
                // nobody works is not an answer worth offering.
                name: 'place',
                label: 'admin.staff.place',
                options: (rows) =>
                    Promise.resolve(
                        [...new Set(rows.flatMap((row) => placesOf(row)))]
                            .sort((a, b) => a.localeCompare(b, 'vi'))
                            .map((place) => ({ value: place, label: place }))
                    ),
                match: (row, value) => placesOf(row).includes(value),
            },
            {
                name: 'assigned',
                label: 'admin.staff.assignment',
                options: () =>
                    Promise.resolve([
                        {
                            value: 'assigned',
                            label: label('admin.staff.assigned'),
                        },
                        {
                            value: 'unassigned',
                            label: label('admin.staff.unassigned'),
                        },
                    ]),
                match: (row, value) =>
                    value === 'assigned'
                        ? placesOf(row).length > 0
                        : placesOf(row).length === 0,
            },
            {
                name: 'status',
                label: 'admin.crud.status',
                options: () =>
                    Promise.resolve([
                        { value: 'active', label: label('admin.crud.active') },
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
        ],
        list: () => loadStaffRows(admin, logistics, label),
        openDetail: openPlace,
    };
}

/**
 * The roster, assembled from the three places the platform keeps it.
 *
 * Every read is failure-tolerant on its own: a hub whose roster cannot be read
 * costs that hub's members their place label, not the whole page. The one thing
 * that must not happen here is the failure mode the chợ staff tab had — a
 * single refused request answering "nobody works anywhere".
 */
export async function loadStaffRows(
    admin: AdminService,
    logistics: LogisticsAdminService,
    label: (key: string) => string
): Promise<CrudRow[]> {
    const [agents, hubStaff, drivers, hubs, agentAssignments] =
        await Promise.all([
            admin.listUsersByRole(MARKET_AGENT).catch(() => []),
            admin.listUsersByRole(HUB_STAFF).catch(() => []),
            admin.listUsersByRole(DRIVER).catch(() => []),
            logistics.hubOptions().catch(() => []),
            admin.getMarketAgentsWithAssignments().catch(() => ({
                agents: [] as AdminUserRow[],
                agentsByMarket: new Map<string, AdminUserRow[]>(),
            })),
        ]);

    const markets = await logistics.marketOptions().catch(() => []);
    const marketNames = new Map(
        markets.map((market): [string, string] => [market.value, market.label])
    );

    // agent id → the chợ they hold, by name. `agentsByMarket` is keyed the
    // other way round, which is what the chợ pages need and this page does not.
    const agentPlaces = new Map<string, { ids: string[]; names: string[] }>();
    for (const [marketId, list] of agentAssignments.agentsByMarket) {
        for (const agent of list) {
            const entry = agentPlaces.get(agent.id) ?? { ids: [], names: [] };
            entry.ids.push(marketId);
            entry.names.push(marketNames.get(marketId) ?? marketId);
            agentPlaces.set(agent.id, entry);
        }
    }

    // user id → the hubs they are rostered on, for both hub-scoped roles.
    const rosters = await mapWithLimit(
        hubs,
        ROSTER_READ_CONCURRENCY,
        async (hub) => ({
            hub,
            staff: await logistics.getHubStaffAssignments(hub.value),
            drivers: await logistics.getHubDriverAssignments(hub.value),
        }),
        null
    );
    const hubPlaces = new Map<string, { ids: string[]; names: string[] }>();
    for (const roster of rosters) {
        if (!roster) {
            continue;
        }
        for (const userId of [...roster.staff, ...roster.drivers]) {
            const entry = hubPlaces.get(userId) ?? { ids: [], names: [] };
            entry.ids.push(roster.hub.value);
            entry.names.push(roster.hub.label);
            hubPlaces.set(userId, entry);
        }
    }

    const unassigned = label('admin.staff.unassigned');
    const toRow = (
        person: AdminUserRow,
        role: StaffRole,
        places: { ids: string[]; names: string[] } | undefined
    ): StaffRow => {
        const names = places?.names ?? [];
        return {
            id: person.id,
            email: person.email || person.id,
            phone: person.phone || '',
            role,
            places: names,
            // A dash would read as "no data"; this says which it is.
            placeLabel: names.length ? names.join(', ') : unassigned,
            isActive: person.isActive !== false,
            // Where a row click goes — the first place, since that is the one
            // the label leads with.
            marketId: role === MARKET_AGENT ? places?.ids[0] ?? '' : '',
            hubId: role === MARKET_AGENT ? '' : places?.ids[0] ?? '',
        };
    };

    return [
        ...agents.map((person) =>
            toRow(person, MARKET_AGENT, agentPlaces.get(person.id))
        ),
        ...hubStaff.map((person) =>
            toRow(person, HUB_STAFF, hubPlaces.get(person.id))
        ),
        ...drivers.map((person) =>
            toRow(person, DRIVER, hubPlaces.get(person.id))
        ),
    ];
}
