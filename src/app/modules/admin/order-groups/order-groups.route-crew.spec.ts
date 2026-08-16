import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { PermissionsService } from 'app/core/auth/permissions/permissions.service';
import { AdminService } from '../admin.service';
import { LogisticsAdminService } from '../logistics/logistics-admin.service';
import { CrudRow } from '../shared/resource-crud.types';
import { OrderGroupsComponent } from './order-groups.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

const adminStub: Partial<AdminService> = {
    getOrderGroups: () =>
        Promise.resolve({ groups: [], totalCount: 0, page: 1, pageSize: 10 }),
    getMarkets: () => Promise.resolve([]),
    getHubs: () => Promise.resolve([]),
    getAgentOptions: () => Promise.resolve([]),
    getMarketSessions: () => Promise.resolve([]),
};

function build(): OrderGroupsComponent {
    TestBed.configureTestingModule({
        providers: [
            provideTransloco({
                config: { availableLangs: ['en'], defaultLang: 'en' },
                loader: StubTranslocoLoader,
            }),
            { provide: AdminService, useValue: adminStub },
            { provide: LogisticsAdminService, useValue: {} },
            { provide: PermissionsService, useValue: { hasRole: () => true } },
            { provide: Router, useValue: { navigate: () => undefined } },
            {
                provide: ActivatedRoute,
                useValue: { snapshot: { data: {}, queryParamMap: null } },
            },
        ],
    });
    return TestBed.createComponent(OrderGroupsComponent).componentInstance;
}

const DRIVER: CrudRow = {
    id: 'd0000000-1111-2222-3333-444444444444',
    fullName: 'Trần Văn Tài',
    email: 'tai@freshflow.vn',
    isActive: true,
};

const VEHICLE: CrudRow = {
    id: 'v0000000-1111-2222-3333-444444444444',
    plateNumber: '51C-123.45',
    capacityKg: 1200,
};

const route = (patch: Partial<CrudRow> = {}): CrudRow => ({
    id: 'r0000000-1111-2222-3333-444444444444',
    status: 'assigned',
    driverUserId: DRIVER.id,
    vehicleId: VEHICLE.id,
    ...patch,
});

/**
 * `RouteDto` names neither the driver nor the truck — it carries two ids — so
 * the route card can only report a crew by resolving them against the hub's
 * rosters. These cover what it says when the rosters can, cannot, or have not
 * yet answered.
 */
describe('Market session route crew', () => {
    it('says nothing about a route nobody is on yet', () => {
        const component = build();

        expect(
            component.routeCrew(route({ driverUserId: '', vehicleId: '' }))
        ).toBeNull();
    });

    it('names the driver and the truck once they are assigned', () => {
        const component = build();
        component.dispatchDrivers.set([DRIVER]);
        component.dispatchVehicles.set([VEHICLE]);

        const crew = component.routeCrew(route());

        expect(crew?.driverName).toBe('Trần Văn Tài');
        expect(crew?.driverEmail).toBe('tai@freshflow.vn');
        expect(crew?.vehicleName).toBe('51C-123.45 · 1200 kg');
        expect(crew?.driverOffRoster).toBeFalse();
        expect(crew?.vehicleOffRoster).toBeFalse();
    });

    it('still reports a crew the rosters cannot name', () => {
        const component = build();
        component.dispatchDrivers.set([DRIVER]);
        component.dispatchVehicles.set([VEHICLE]);

        const crew = component.routeCrew(
            route({ driverUserId: 'e9999999-0000-0000-0000-000000000000' })
        );

        // Shortened rather than blank: a route assigned to someone this hub no
        // longer lists must not read as an uncrewed one.
        expect(crew?.driverName).toBe('#E9999999');
        expect(crew?.driverOffRoster).toBeTrue();
    });

    /**
     * The rosters are read alongside the routes, so there is a moment where the
     * route is known and the roster is not. Warning then would put "no longer
     * on this hub" on every assigned route for that moment.
     */
    it('does not call a driver missing while the roster is still unread', () => {
        const component = build();

        const crew = component.routeCrew(route());

        expect(crew?.driverOffRoster).toBeFalse();
        expect(crew?.vehicleOffRoster).toBeFalse();
        expect(crew?.driverName).toBe('#D0000000');
    });

    it('flags a driver the roster carries as deactivated', () => {
        const component = build();
        component.dispatchDrivers.set([{ ...DRIVER, isActive: false }]);

        const crew = component.routeCrew(route());

        expect(crew?.driverInactive).toBeTrue();
        expect(crew?.driverOffRoster).toBeFalse();
    });

    it('falls back to the email when the driver has no name on file', () => {
        const component = build();
        component.dispatchDrivers.set([{ ...DRIVER, fullName: '' }]);

        expect(component.routeCrew(route())?.driverName).toBe(
            'tai@freshflow.vn'
        );
    });
});
