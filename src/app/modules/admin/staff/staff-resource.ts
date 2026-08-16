import { mapWithLimit } from 'app/core/util/concurrency';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { CrudRow } from '../shared/resource-crud.types';

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
 * chợ would quietly hide the second one in the Users tab.
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
 * Assignment data for the three staff-role tabs on Admin ▸ Users, assembled
 * from the separate places where the platform stores it.
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
): Promise<StaffRow[]> {
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
            // Keep profile fields returned by the Users API (notably the
            // avatar and full name) when this roster is reused by Users tabs.
            ...person,
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
