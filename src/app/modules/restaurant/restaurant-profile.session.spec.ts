import { TestBed } from '@angular/core/testing';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.types';
import { ReplaySubject } from 'rxjs';
import { RestaurantProfileService } from './restaurant-profile.service';

const restaurant = (id: string): User =>
    ({ id, email: `${id}@viet.local`, role: 'restaurant' }) as User;

function build(): {
    service: RestaurantProfileService;
    user: ReplaySubject<User | null>;
} {
    const user = new ReplaySubject<User | null>(1);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [
            {
                provide: UserService,
                useValue: { user$: user.asObservable(), current: null },
            },
        ],
    });
    return { service: TestBed.inject(RestaurantProfileService), user };
}

/**
 * The cached profile carries `restaurantId`, and every `{restaurantId}`
 * endpoint — credit, order history, scheduled orders — is called with it. Held
 * across a sign-in it points the new account at the previous restaurant, which
 * the backend refuses with a 403; the symptom is a restaurant whose credit and
 * order history simply vanish.
 */
describe('RestaurantProfileService — the cache belongs to the session', () => {
    it('forgets the profile when a different account signs in', () => {
        const { service, user } = build();
        user.next(restaurant('u-1'));
        service['_profile'].set({ name: 'Bếp Việt', restaurantId: 'res-1' });
        expect(service.profile()?.restaurantId).toBe('res-1');

        user.next(restaurant('u-2'));

        expect(service.profile()).toBeNull();
    });

    it('forgets the saved addresses too', () => {
        const { service, user } = build();
        user.next(restaurant('u-1'));
        service['_deliveryAddresses'].set([
            { id: 'a-1', addressLine: '25 Lê Lợi' },
        ]);

        user.next(restaurant('u-2'));

        expect(service.deliveryAddresses()).toEqual([]);
    });

    it('forgets it on sign-out, before anyone else signs in', () => {
        const { service, user } = build();
        user.next(restaurant('u-1'));
        service['_profile'].set({ name: 'Bếp Việt', restaurantId: 'res-1' });

        user.next(null);

        expect(service.profile()).toBeNull();
    });

    // A re-emit of the same account is an ordinary profile refresh — dropping
    // the cache there would make every one of them re-read.
    it('keeps the cache when the same account emits again', () => {
        const { service, user } = build();
        user.next(restaurant('u-1'));
        service['_profile'].set({ name: 'Bếp Việt', restaurantId: 'res-1' });

        user.next(restaurant('u-1'));

        expect(service.profile()?.restaurantId).toBe('res-1');
    });
});
