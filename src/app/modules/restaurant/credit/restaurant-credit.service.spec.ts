import { TestBed } from '@angular/core/testing';
import { restaurantCreditApi } from 'contract';
import { RestaurantProfileService } from '../restaurant-profile.service';
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
    let profileService: RestaurantProfileService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(RestaurantCreditService);
        profileService = TestBed.inject(RestaurantProfileService);
    });

    describe('getBalance', () => {
        /**
         * Regression: this used to send the signed-in **user** id, which the
         * backend answers 404 for. The restaurant has its own id, published by
         * `GET /restaurants/me/profile`.
         */
        it('sends the restaurant id from the profile, not the user id', async () => {
            spyOn(profileService, 'restaurantId').and.resolveTo('rest-456');
            const get = spyOn(
                restaurantCreditApi,
                'apiV1RestaurantsRestaurantIdCreditGetRaw'
            ).and.resolveTo(
                rawResponse({
                    data: { creditLimit: 1000, currentBalance: 200 },
                })
            );

            const balance = await service.getBalance();

            expect(get).toHaveBeenCalledWith({ restaurantId: 'rest-456' });
            expect(balance).toEqual({ creditLimit: 1000, currentBalance: 200 });
        });
    });
});
