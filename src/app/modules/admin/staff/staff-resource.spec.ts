import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { CrudRow } from '../shared/resource-crud.types';
import { loadStaffRows } from './staff-resource';

const user = (id: string, email: string, isActive = true): AdminUserRow =>
    ({ id, email, phone: '0900000000', isActive }) as AdminUserRow;

const MARKETS = [
    { value: 'm-1', label: 'Chợ Bình Điền' },
    { value: 'm-2', label: 'Chợ Thủ Đức' },
];
const HUBS = [
    { value: 'h-1', label: 'Hub Bình Điền' },
    { value: 'h-2', label: 'Hub Thủ Đức' },
];

interface Stubs {
    admin: AdminService;
    logistics: LogisticsAdminService;
}

function stubs(overrides: Partial<Record<string, unknown>> = {}): Stubs {
    const admin = {
        listUsersByRole: (role: string) =>
            Promise.resolve(
                role === 'market_agent'
                    ? [
                          user('ag-1', 'agent1@ff.vn'),
                          user('ag-2', 'agent2@ff.vn'),
                      ]
                    : role === 'hub_staff'
                      ? [user('hs-1', 'staff1@ff.vn')]
                      : [user('dr-1', 'driver1@ff.vn', false)]
            ),
        getMarketAgentsWithAssignments: () =>
            Promise.resolve({
                agents: [],
                agentsByMarket: new Map([
                    ['m-1', [user('ag-1', 'agent1@ff.vn')]],
                    ['m-2', [user('ag-1', 'agent1@ff.vn')]],
                ]),
            }),
        ...overrides,
    } as unknown as AdminService;

    const logistics = {
        hubOptions: () => Promise.resolve(HUBS),
        marketOptions: () => Promise.resolve(MARKETS),
        getHubStaffAssignments: (hubId: string) =>
            Promise.resolve(hubId === 'h-1' ? ['hs-1'] : []),
        getHubDriverAssignments: (hubId: string) =>
            Promise.resolve(hubId === 'h-2' ? ['dr-1'] : []),
        ...overrides,
    } as unknown as LogisticsAdminService;

    return { admin, logistics };
}

const label = (key: string): string => key;

function rowFor(rows: CrudRow[], email: string): CrudRow {
    return rows.find((row) => row['email'] === email) as CrudRow;
}

/**
 * The roster exists nowhere in one place: an agent's chợ come from their market
 * assignments, hub staff and drivers from each hub's own roster, and the people
 * themselves from the user list. These cover the stitching.
 */
describe('Admin staff roster', () => {
    it('lists all three staff roles, and nobody else', async () => {
        const { admin, logistics } = stubs();

        const rows = await loadStaffRows(admin, logistics, label);

        expect(rows.map((row) => row['role'])).toEqual([
            'market_agent',
            'market_agent',
            'hub_staff',
            'driver',
        ]);
    });

    it('names every chợ an agent holds, not just the first', async () => {
        const { admin, logistics } = stubs();

        const row = rowFor(
            await loadStaffRows(admin, logistics, label),
            'agent1@ff.vn'
        );

        expect(row['places']).toEqual(['Chợ Bình Điền', 'Chợ Thủ Đức']);
        expect(row['placeLabel']).toBe('Chợ Bình Điền, Chợ Thủ Đức');
    });

    it('says so when someone is on no roster at all', async () => {
        const { admin, logistics } = stubs();

        const row = rowFor(
            await loadStaffRows(admin, logistics, label),
            'agent2@ff.vn'
        );

        expect(row['places']).toEqual([]);
        // A dash would read as missing data; this reads as the state it is.
        expect(row['placeLabel']).toBe('admin.staff.unassigned');
    });

    it('reads hub staff and drivers off the hub they are rostered on', async () => {
        const { admin, logistics } = stubs();
        const rows = await loadStaffRows(admin, logistics, label);

        expect(rowFor(rows, 'staff1@ff.vn')['placeLabel']).toBe(
            'Hub Bình Điền'
        );
        expect(rowFor(rows, 'driver1@ff.vn')['placeLabel']).toBe('Hub Thủ Đức');
    });

    it('carries the account status through', async () => {
        const rows = await loadStaffRows(
            stubs().admin,
            stubs().logistics,
            label
        );

        expect(rowFor(rows, 'driver1@ff.vn')['isActive']).toBeFalse();
        expect(rowFor(rows, 'staff1@ff.vn')['isActive']).toBeTrue();
    });

    /**
     * One hub refusing its roster must cost that hub's members their place —
     * not empty the page. This is the failure the chợ staff tab used to have.
     */
    it('keeps the rest of the roster when one hub read fails', async () => {
        const { admin } = stubs();
        const logistics = {
            hubOptions: () => Promise.resolve(HUBS),
            marketOptions: () => Promise.resolve(MARKETS),
            getHubStaffAssignments: (hubId: string) =>
                hubId === 'h-1'
                    ? Promise.reject(new Error('429'))
                    : Promise.resolve([]),
            getHubDriverAssignments: (hubId: string) =>
                Promise.resolve(hubId === 'h-2' ? ['dr-1'] : []),
        } as unknown as LogisticsAdminService;

        const rows = await loadStaffRows(admin, logistics, label);

        expect(rows.length).toBe(4);
        expect(rowFor(rows, 'driver1@ff.vn')['placeLabel']).toBe('Hub Thủ Đức');
        expect(rowFor(rows, 'agent1@ff.vn')['placeLabel']).toBe(
            'Chợ Bình Điền, Chợ Thủ Đức'
        );
    });

    it('survives a user list that cannot be read at all', async () => {
        const { logistics } = stubs();
        const admin = {
            listUsersByRole: () => Promise.reject(new Error('500')),
            getMarketAgentsWithAssignments: () =>
                Promise.reject(new Error('500')),
        } as unknown as AdminService;

        expect(await loadStaffRows(admin, logistics, label)).toEqual([]);
    });
});
