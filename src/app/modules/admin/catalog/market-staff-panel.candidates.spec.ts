import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { MarketStaffPanelComponent } from './market-staff-panel.component';

/** Minimal Transloco loader — no label in this file is under test. */
class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

/** Hub rosters the fake backend answers with, keyed by hub. */
const ROSTERS: Record<string, string[]> = {
    'hub-1': ['staff-1'],
    'hub-2': ['staff-3'],
};

const PEOPLE = [
    { id: 'staff-1', email: 'one@freshflow.test', isActive: true },
    { id: 'staff-2', email: 'two@freshflow.test', isActive: true },
    { id: 'staff-3', email: 'three@freshflow.test', isActive: true },
];

function createPanel(): {
    panel: MarketStaffPanelComponent;
    replaceStaff: jasmine.Spy;
} {
    const replaceStaff = jasmine
        .createSpy('replaceHubStaffAssignments')
        .and.resolveTo(undefined);
    const logistics = {
        getHubStaffAssignments: (hubId: string) =>
            Promise.resolve([...(ROSTERS[hubId] ?? [])]),
        getHubDriverAssignments: () => Promise.resolve([]),
        replaceHubStaffAssignments: replaceStaff,
        replaceHubDriverAssignments: () => Promise.resolve(undefined),
        hubOptions: () =>
            Promise.resolve([
                { value: 'hub-1', label: 'Hub 1' },
                { value: 'hub-2', label: 'Hub 2' },
            ]),
        marketOptions: () => Promise.resolve([]),
    };
    const admin = {
        listUsersByRole: () => Promise.resolve(PEOPLE),
        getMarketAgentsWithAssignments: () =>
            Promise.resolve({ agents: [], agentsByMarket: new Map() }),
        setMarketAgents: () => Promise.resolve(undefined),
        getMarketAssignments: () => Promise.resolve([]),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        imports: [MarketStaffPanelComponent],
        providers: [
            provideTransloco({
                config: { availableLangs: ['en'], defaultLang: 'en' },
                loader: StubTranslocoLoader,
            }),
            { provide: AdminService, useValue: admin },
            { provide: LogisticsAdminService, useValue: logistics },
        ],
    });
    // `componentInstance` without `detectChanges`: `ngOnInit` would start the
    // panel's own loads, and each test drives the dialog directly instead.
    const panel = TestBed.createComponent(
        MarketStaffPanelComponent
    ).componentInstance;
    // What `_load()` would have produced: the chợ's two hubs, one person on
    // each. The dialog used to read *this* to decide who was already assigned,
    // which is exactly what the tests below have to be able to catch.
    panel.rows.set([
        {
            id: 'staff-1',
            email: 'one@freshflow.test',
            phone: '',
            avatarUrl: '',
            role: 'hub_staff',
            hubId: 'hub-1',
            position: 'Hub 1',
            removable: true,
        },
        {
            id: 'staff-3',
            email: 'three@freshflow.test',
            phone: '',
            avatarUrl: '',
            role: 'hub_staff',
            hubId: 'hub-2',
            position: 'Hub 2',
            removable: true,
        },
    ]);
    return { panel, replaceStaff };
}

/** Lets the panel's chain of awaited reads settle before asserting on it. */
function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * A hub roster holds as many people as it is given —
 * `PUT /hubs/{hubId}/staff-assignments` takes the whole list and the table is
 * keyed on `(hub_id, user_id)`. The dialog used to decide who was "already
 * here" from the *chợ's* roster, so anyone standing on one hub was greyed out
 * on every other hub of that chợ, and a second hub could not be staffed at all.
 */
describe('MarketStaffPanelComponent — who is already assigned', () => {
    it('greys out only the people on the hub being edited', async () => {
        const { panel } = createPanel();

        panel.addForm.controls.role.setValue('hub_staff');
        panel.onRoleChange('hub_staff');
        panel.addForm.controls.hubId.setValue('hub-1');
        panel.onHubChange('hub-1');
        await flush();

        const byId = new Map(panel.candidates().map((row) => [row.id, row]));
        expect(byId.get('staff-1')?.alreadyHere).toBeTrue();
        expect(byId.get('staff-2')?.alreadyHere).toBeFalse();
        // On hub-2, not this one — pickable here.
        expect(byId.get('staff-3')?.alreadyHere).toBeFalse();
    });

    it('offers someone already on another hub of the same chợ', async () => {
        const { panel } = createPanel();

        panel.addForm.controls.role.setValue('hub_staff');
        panel.onRoleChange('hub_staff');
        // `staff-1` works hub-1; hub-2 is a different roster, so they are a
        // legitimate pick here — this is the case the old market-wide check
        // made impossible.
        panel.addForm.controls.hubId.setValue('hub-2');
        panel.onHubChange('hub-2');
        await flush();

        const staffOne = panel.candidates().find((row) => row.id === 'staff-1');
        expect(staffOne?.alreadyHere).toBeFalse();
    });

    it('claims nobody is taken until a hub is chosen', async () => {
        const { panel } = createPanel();

        panel.addForm.controls.role.setValue('hub_staff');
        panel.onRoleChange('hub_staff');
        await flush();

        expect(
            panel.candidates().every((row) => row.alreadyHere === false)
        ).toBeTrue();
    });

    it('drops picks made against the hub that was just switched away from', async () => {
        const { panel } = createPanel();

        panel.addForm.controls.role.setValue('hub_staff');
        panel.onRoleChange('hub_staff');
        panel.togglePick('staff-2', true);
        expect(panel.pickedCount()).toBe(1);

        panel.onHubChange('hub-2');
        expect(panel.pickedCount()).toBe(0);
    });

    it('sends every picked id together with the roster already there', async () => {
        const { panel, replaceStaff } = createPanel();

        panel.addForm.controls.role.setValue('hub_staff');
        panel.onRoleChange('hub_staff');
        panel.addForm.controls.hubId.setValue('hub-1');
        panel.onHubChange('hub-1');
        panel.togglePick('staff-2', true);
        panel.togglePick('staff-3', true);

        panel.save();
        // Let the roster read that precedes the write settle, then the write.
        await flush();

        expect(replaceStaff).toHaveBeenCalledTimes(1);
        const [hubId, ids] = replaceStaff.calls.mostRecent().args as [
            string,
            string[],
        ];
        expect(hubId).toBe('hub-1');
        // The one already there is kept — a replace endpoint drops whoever is
        // left out — and both new picks go in the same call.
        expect([...ids].sort()).toEqual(['staff-1', 'staff-2', 'staff-3']);
    });
});
