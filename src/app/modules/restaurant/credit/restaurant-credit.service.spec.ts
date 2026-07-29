import { TestBed } from '@angular/core/testing';
import { UserService } from 'app/core/user/user.service';
import { restaurantCreditApi } from 'contract';
import { RestaurantCreditService } from './restaurant-credit.service';

/**
 * Minimal `ApiResponse`-like stub whose `.raw` behaves like a `Response` for
 * `parseJson` (`app/core/api/envelope.ts`), which reads `.text()` — not `.json()`.
 */
function rawResponse(body: unknown): any {
    return {
        raw: {
            text: () =>
                Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
        },
    };
}

describe('RestaurantCreditService', () => {
    let service: RestaurantCreditService;
    let userService: UserService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(RestaurantCreditService);
        userService = TestBed.inject(UserService);
    });

    describe('getBalance', () => {
        it('resolves restaurantId from the signed-in user id (userId doubles as restaurantId)', async () => {
            userService.user = {
                id: 'user-123',
                email: 'r@example.com',
                role: 'restaurant',
            };
            const get = spyOn(
                restaurantCreditApi,
                'apiV1RestaurantsRestaurantIdCreditGetRaw'
            ).and.resolveTo(
                rawResponse({
                    data: { creditLimit: 1000, currentBalance: 200 },
                })
            );

            const balance = await service.getBalance();

            expect(get).toHaveBeenCalledWith({ restaurantId: 'user-123' });
            expect(balance).toEqual({ creditLimit: 1000, currentBalance: 200 });
        });
    });
});
