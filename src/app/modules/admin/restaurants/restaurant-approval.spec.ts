import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';
import { RestaurantDetailComponent } from './restaurant-detail.component';
import { RestaurantsAdminComponent } from './restaurants-admin.component';

class StubTranslocoLoader {
    getTranslation(): Promise<Record<string, string>> {
        return Promise.resolve({});
    }
}

/**
 * The live API reports `isActive: true` for **every** restaurant, waiting ones
 * included — the approval lifecycle lives in `restaurantStatus`. Both screens
 * used to gate the approve action on `isActive`, so "Duyệt" never rendered and
 * a pending restaurant could not be approved from the UI at all.
 */
const pending: AdminUserRow = {
    id: 'user-1',
    email: 'pending@example.test',
    role: 'restaurant',
    isActive: true,
    isApproved: false,
    restaurantStatus: 'pending',
    restaurantId: 'rest-1',
};

const row = (patch: Partial<AdminUserRow>): AdminUserRow => ({
    ...pending,
    ...patch,
});

function configure(adminStub: Partial<AdminService>, paramId = 'user-1'): void {
    TestBed.configureTestingModule({
        providers: [
            provideTransloco({
                config: { availableLangs: ['en'], defaultLang: 'en' },
                loader: StubTranslocoLoader,
            }),
            { provide: AdminService, useValue: adminStub },
            { provide: Router, useValue: { navigate: () => undefined } },
            {
                provide: ActivatedRoute,
                useValue: { snapshot: { paramMap: { get: () => paramId } } },
            },
        ],
    });
}

describe('Restaurant approval actions', () => {
    it('offers approve for a pending restaurant even though isActive is true', () => {
        configure({});
        const component = TestBed.createComponent(
            RestaurantsAdminComponent
        ).componentInstance;

        expect(component.canApprove(pending)).toBeTrue();
        expect(
            component.canApprove(row({ restaurantStatus: 'active' }))
        ).toBeFalse();
        expect(
            component.canApprove(row({ restaurantStatus: 'suspended' }))
        ).toBeFalse();
    });

    it('falls back to isApproved when restaurantStatus is absent', () => {
        configure({});
        const component = TestBed.createComponent(
            RestaurantsAdminComponent
        ).componentInstance;

        expect(
            component.canApprove(
                row({ restaurantStatus: null, isApproved: false })
            )
        ).toBeTrue();
        expect(
            component.canApprove(
                row({ restaurantStatus: null, isApproved: true })
            )
        ).toBeFalse();
    });

    it('flips the row to approved without waiting for a reload', async () => {
        let approvedId: string | null = null;
        configure({
            approveRestaurant: (id: string) => {
                approvedId = id;
                return Promise.resolve();
            },
        });
        const component = TestBed.createComponent(
            RestaurantsAdminComponent
        ).componentInstance;
        component.users.set([pending]);

        component.approve(pending);
        await Promise.resolve();
        await Promise.resolve();

        expect(approvedId).toBe('rest-1');
        expect(component.users()[0].restaurantStatus).toBe('active');
        expect(component.users()[0].isApproved).toBeTrue();
        expect(component.canApprove(component.users()[0])).toBeFalse();
    });

    it('shows exactly one lifecycle action per state on the detail page', () => {
        configure({
            getUsers: () => Promise.resolve({ users: [], totalCount: 0 }),
        });
        const component = TestBed.createComponent(
            RestaurantDetailComponent
        ).componentInstance;

        component.user.set(pending);
        expect([
            component.canApprove(),
            component.canSuspend(),
            component.canReactivate(),
        ]).toEqual([true, false, false]);

        component.user.set(
            row({ restaurantStatus: 'active', isApproved: true })
        );
        expect([
            component.canApprove(),
            component.canSuspend(),
            component.canReactivate(),
        ]).toEqual([false, true, false]);

        component.user.set(row({ restaurantStatus: 'suspended' }));
        expect([
            component.canApprove(),
            component.canSuspend(),
            component.canReactivate(),
        ]).toEqual([false, false, true]);
    });
});

/**
 * `GET /restaurants/{id}/credit` always answers with a record: a restaurant
 * that has never been given a limit reads back `creditLimit: 0`, never `null`.
 * The card used to treat "not null" as "already configured", so it rendered a
 * read-only `0 ₫` and `saveCreditLimit()` refused to send — there was no way
 * to set a limit at all.
 */
describe('Restaurant credit limit', () => {
    it('stays editable when the limit reads back as 0', () => {
        configure({});
        const component = TestBed.createComponent(
            RestaurantDetailComponent
        ).componentInstance;

        component.user.set(row({ restaurantStatus: 'active' }));
        component.credit.set({
            creditLimit: 0,
            outstandingBalance: 0,
            availableCredit: 0,
        });

        expect(component.creditLimit()).toBe(0);
        component.startEditingCreditLimit();
        expect(component.editingCreditLimit()).toBeTrue();
        expect(component.creditLimitForm.controls.creditLimit.value).toBe(0);
    });

    it('sends the new limit even when one is already configured', async () => {
        let sent: { id: string; limit: number | undefined } | null = null;
        configure({
            setCreditLimit: (id: string, payload: { creditLimit?: number }) => {
                sent = { id, limit: payload.creditLimit };
                return Promise.resolve();
            },
            getRestaurantCredit: () => Promise.resolve(null),
            getCreditStatements: () => Promise.resolve([]),
            getCreditTransactions: () => Promise.resolve([]),
        });
        const component = TestBed.createComponent(
            RestaurantDetailComponent
        ).componentInstance;

        component.user.set(row({ restaurantStatus: 'active' }));
        component.credit.set({ creditLimit: 1_000_000 });
        component.startEditingCreditLimit();
        component.creditLimitForm.patchValue({ creditLimit: 5_000_000 });

        component.saveCreditLimit();
        await Promise.resolve();
        await Promise.resolve();

        expect(sent).toEqual({ id: 'rest-1', limit: 5_000_000 });
    });

    it('reads the balance from outstandingBalance, not the alias', () => {
        configure({});
        const component = TestBed.createComponent(
            RestaurantDetailComponent
        ).componentInstance;

        component.credit.set({
            creditLimit: 1_000_000,
            outstandingBalance: 100_000,
            availableCredit: 900_000,
        });

        expect(component.outstandingBalance()).toBe(100_000);
        expect(component.availableCredit()).toBe(900_000);

        component.credit.set(null);
        expect(component.outstandingBalance()).toBeNull();
    });
});
