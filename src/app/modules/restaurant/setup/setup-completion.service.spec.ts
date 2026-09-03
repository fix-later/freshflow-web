import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.types';
import { ReplaySubject } from 'rxjs';
import { RestaurantProfileService } from '../restaurant-profile.service';
import {
    DeliveryAddressView,
    RestaurantProfileView,
} from '../restaurant-profile.types';
import { SetupCompletionService } from './setup-completion.service';

/** A business profile with every field the `business` item requires. */
function completeProfile(
    overrides: Partial<RestaurantProfileView> = {}
): RestaurantProfileView {
    return {
        name: 'Green Garden',
        address: '12 Nguyen Hue',
        contactPerson: 'Mai',
        pickupStart: '06:00:00',
        pickupEnd: '10:00:00',
        businessLicenseUrl: 'https://cdn.example/licence.jpg',
        ...overrides,
    };
}

function address(
    overrides: Partial<DeliveryAddressView> = {}
): DeliveryAddressView {
    return { id: 'a1', addressLine: '5 Le Loi', ...overrides };
}

describe('SetupCompletionService', () => {
    let service: SetupCompletionService;
    let user: ReplaySubject<User | null>;
    let profile: ReturnType<typeof signal<RestaurantProfileView | null>>;
    let addresses: ReturnType<typeof signal<DeliveryAddressView[]>>;
    let currentUser: User | null;

    beforeEach(() => {
        user = new ReplaySubject<User | null>(1);
        profile = signal<RestaurantProfileView | null>(null);
        addresses = signal<DeliveryAddressView[]>([]);
        currentUser = { id: 'r-1', email: 'a@b.c', role: 'restaurant' };
        sessionStorage.clear();
        localStorage.clear();

        TestBed.configureTestingModule({
            providers: [
                {
                    provide: RestaurantProfileService,
                    useValue: {
                        profile: profile.asReadonly(),
                        deliveryAddresses: addresses.asReadonly(),
                        loadProfile: () => Promise.resolve(profile()),
                        loadDeliveryAddresses: () =>
                            Promise.resolve(addresses()),
                    },
                },
                {
                    provide: UserService,
                    useValue: {
                        // The service watches this stream so a new account does
                        // not inherit the previous one's cached load.
                        user$: user.asObservable(),
                        get current(): User | null {
                            return currentUser;
                        },
                    },
                },
            ],
        });
        service = TestBed.inject(SetupCompletionService);
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    describe('business item', () => {
        it('is done only when every required field is filled', () => {
            profile.set(completeProfile());
            expect(service.states().business).toBe('done');
        });

        it('is outstanding when the profile has never been loaded', () => {
            expect(service.states().business).toBe('outstanding');
        });

        const requiredFields: ReadonlyArray<keyof RestaurantProfileView> = [
            'name',
            'address',
            'contactPerson',
        ];

        it('is done even when pickupStart/pickupEnd are absent (retired field)', () => {
            profile.set(
                completeProfile({ pickupStart: null, pickupEnd: null })
            );
            expect(service.states().business).toBe('done');
        });

        requiredFields.forEach((field) => {
            it(`is outstanding when ${field} is missing`, () => {
                profile.set(completeProfile({ [field]: null }));
                expect(service.states().business).toBe('outstanding');
            });

            it(`is outstanding when ${field} is whitespace only`, () => {
                profile.set(completeProfile({ [field]: '   ' }));
                expect(service.states().business).toBe('outstanding');
            });
        });

        it('ignores the licence when judging the business fields', () => {
            profile.set(completeProfile({ businessLicenseUrl: null }));
            expect(service.states().business).toBe('done');
        });
    });

    describe('license item', () => {
        it('is done when a licence URL is stored', () => {
            profile.set(completeProfile());
            expect(service.states().license).toBe('done');
        });

        it('is outstanding when the licence is absent, even on a full profile', () => {
            profile.set(completeProfile({ businessLicenseUrl: null }));
            const states = service.states();
            expect(states.business).toBe('done');
            expect(states.license).toBe('outstanding');
        });

        it('is done independently of the business fields being complete', () => {
            profile.set(completeProfile({ name: '', address: null }));
            expect(service.states().license).toBe('done');
        });
    });

    describe('address item', () => {
        it('is outstanding when no address is saved', () => {
            expect(service.states().address).toBe('outstanding');
        });

        it('is done with one address even when none is marked default', () => {
            addresses.set([address({ isDefault: false })]);
            expect(service.states().address).toBe('done');
        });

        it('is done with several addresses', () => {
            addresses.set([address(), address({ id: 'a2' })]);
            expect(service.states().address).toBe('done');
        });
    });

    describe('progress', () => {
        it('counts out of three when nothing is filled', () => {
            const progress = service.progress();
            expect(progress.completed).toBe(0);
            expect(progress.total).toBe(3);
            expect(progress.isComplete).toBeFalse();
            expect(progress.outstanding).toEqual([
                'business',
                'license',
                'address',
            ]);
        });

        it('reaches 3 of 3 without the tax profile ever being saved', () => {
            profile.set(completeProfile());
            addresses.set([address()]);

            const progress = service.progress();
            expect(progress.completed).toBe(3);
            expect(progress.total).toBe(3);
            expect(progress.isComplete).toBeTrue();
            expect(progress.outstanding).toEqual([]);
        });

        it('keeps total at 3 — the tax item never counts', () => {
            profile.set(completeProfile());
            expect(service.progress().total).toBe(3);

            addresses.set([address()]);
            expect(service.progress().total).toBe(3);
        });

        it('lists outstanding items in wizard order', () => {
            profile.set(completeProfile({ businessLicenseUrl: null }));
            expect(service.progress().outstanding).toEqual([
                'license',
                'address',
            ]);
        });

        it('regresses when the last address is removed', () => {
            profile.set(completeProfile());
            addresses.set([address()]);
            expect(service.progress().isComplete).toBeTrue();

            addresses.set([]);

            const progress = service.progress();
            expect(progress.isComplete).toBeFalse();
            expect(progress.completed).toBe(2);
            expect(progress.outstanding).toEqual(['address']);
        });
    });

    describe('dismissal', () => {
        it('is not dismissed by default', () => {
            expect(service.isDismissed()).toBeFalse();
        });

        it('reports dismissed after dismiss()', () => {
            service.dismiss();
            expect(service.isDismissed()).toBeTrue();
        });

        it('does not leak to another restaurant on the same machine', () => {
            service.dismiss();
            expect(service.isDismissed()).toBeTrue();

            currentUser = { id: 'r-2', email: 'x@y.z', role: 'restaurant' };
            expect(service.isDismissed()).toBeFalse();
        });

        it('stores in sessionStorage, not localStorage', () => {
            service.dismiss();

            expect(sessionStorage.getItem('ffx.onboarding.dismissed.r-1')).toBe(
                '1'
            );
            expect(
                localStorage.getItem('ffx.onboarding.dismissed.r-1')
            ).toBeNull();
        });

        it('is a no-op when no user is signed in', () => {
            currentUser = null;

            expect(() => service.dismiss()).not.toThrow();
            expect(service.isDismissed()).toBeFalse();
        });
    });

    describe('load', () => {
        it('only reads once across repeated calls', async () => {
            const profileService = TestBed.inject(RestaurantProfileService);
            const loadProfile = spyOn(
                profileService,
                'loadProfile'
            ).and.resolveTo(null);

            await Promise.all([service.load(), service.load()]);
            await service.load();

            expect(loadProfile).toHaveBeenCalledTimes(1);
        });

        it('resolves even when a read fails, leaving items outstanding', async () => {
            const profileService = TestBed.inject(RestaurantProfileService);
            spyOn(profileService, 'loadProfile').and.rejectWith(
                new Error('offline')
            );

            await expectAsync(service.load()).toBeResolved();
            expect(service.progress().isComplete).toBeFalse();
        });

        it('re-reads after invalidate()', async () => {
            const profileService = TestBed.inject(RestaurantProfileService);
            const loadProfile = spyOn(
                profileService,
                'loadProfile'
            ).and.resolveTo(null);

            await service.load();
            service.invalidate();
            await service.load();

            expect(loadProfile).toHaveBeenCalledTimes(2);
        });
    });
});
