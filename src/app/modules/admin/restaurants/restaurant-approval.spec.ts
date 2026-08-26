import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { AdminService } from '../admin.service';
import { AdminUserRow } from '../admin.types';
import { RestaurantDetailComponent } from './restaurant-detail.component';
import {
    RestaurantsAdminComponent,
    restaurantsForReview,
} from './restaurants-admin.component';

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
    it('places new pending registrations before newer approved restaurants', () => {
        const ordered = restaurantsForReview([
            row({
                id: 'active-new',
                restaurantStatus: 'active',
                isApproved: true,
                createdAt: '2026-08-15T09:00:00Z',
            }),
            row({
                id: 'pending-old',
                createdAt: '2026-08-13T09:00:00Z',
            }),
            row({
                id: 'pending-new',
                createdAt: '2026-08-14T09:00:00Z',
            }),
        ]);

        expect(ordered.map((user) => user.id)).toEqual([
            'pending-new',
            'pending-old',
            'active-new',
        ]);
    });

    it('falls back to isApproved when restaurantStatus is absent', () => {
        configure({});
        const component = TestBed.createComponent(
            RestaurantsAdminComponent
        ).componentInstance;

        // The list no longer approves — the pill is what reads this rule now.
        expect(
            component.approvalKey(
                row({ restaurantStatus: null, isApproved: false })
            )
        ).toBe('admin.users.approval.pending');
        expect(
            component.approvalKey(
                row({ restaurantStatus: null, isApproved: true })
            )
        ).toBe('admin.users.approval.active');
    });

    /**
     * Approving an account that cannot sign in leaves it approved and still
     * locked out, which reads as done and is not — and credit is a relationship
     * with a restaurant that has actually traded.
     */
    it('withholds approval from a stopped account, and credit from an unapproved one', () => {
        configure({
            getUsers: () => Promise.resolve({ users: [], totalCount: 0 }),
        });
        const component = TestBed.createComponent(
            RestaurantDetailComponent
        ).componentInstance;

        component.user.set(row({ isActive: false }));
        expect(component.canApprove()).toBeFalse();

        component.user.set(pending);
        expect(component.canApprove()).toBeTrue();
        expect(component.canManageCredit()).toBeFalse();

        // Suspended still owes money, so settling and the limit stay reachable.
        component.user.set(row({ restaurantStatus: 'suspended' }));
        expect(component.canManageCredit()).toBeTrue();
    });

    it('offers approval or reactivation, never both, on the detail page', () => {
        configure({
            getUsers: () => Promise.resolve({ users: [], totalCount: 0 }),
        });
        const component = TestBed.createComponent(
            RestaurantDetailComponent
        ).componentInstance;

        component.user.set(pending);
        expect([component.canApprove(), component.canReactivate()]).toEqual([
            true,
            false,
        ]);

        component.user.set(
            row({ restaurantStatus: 'active', isApproved: true })
        );
        expect([component.canApprove(), component.canReactivate()]).toEqual([
            false,
            false,
        ]);

        component.user.set(row({ restaurantStatus: 'suspended' }));
        expect([component.canApprove(), component.canReactivate()]).toEqual([
            false,
            true,
        ]);
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

    it('does not allow a credit limit below the outstanding balance', () => {
        configure({});
        const component = TestBed.createComponent(
            RestaurantDetailComponent
        ).componentInstance;
        component.user.set(row({ restaurantStatus: 'active' }));
        component.credit.set({
            creditLimit: 1_000_000,
            outstandingBalance: 400_000,
            availableCredit: 600_000,
        });

        component.startEditingCreditLimit();
        component.creditLimitForm.controls.creditLimit.setValue(399_999);

        expect(
            component.creditLimitForm.controls.creditLimit.hasError('min')
        ).toBeTrue();
    });
});

describe('Restaurant settlement contract', () => {
    it('only accepts backend payment methods and enforces request lengths', () => {
        configure({});
        const component = TestBed.createComponent(
            RestaurantDetailComponent
        ).componentInstance;

        expect(component.settlementPaymentMethods).toEqual([
            'bank_transfer',
            'manual',
        ]);

        component.settleForm.controls.paymentMethod.setValue(
            '' as 'bank_transfer'
        );
        component.settleForm.controls.note.setValue('x'.repeat(501));

        expect(
            component.settleForm.controls.paymentMethod.hasError('required')
        ).toBeTrue();
        expect(
            component.settleForm.controls.note.hasError('maxlength')
        ).toBeTrue();
    });
});
