import { restaurantProfileApi } from 'contract';
import { RestaurantProfileService } from './restaurant-profile.service';

/** Minimal `ApiResponse`-like stub whose `.raw.json()` yields `body`. */
function rawResponse(body: unknown): any {
    return { raw: { json: () => Promise.resolve(body) } };
}

describe('RestaurantProfileService', () => {
    let service: RestaurantProfileService;

    beforeEach(() => {
        service = new RestaurantProfileService();
    });

    describe('loadProfile', () => {
        it('unwraps the { success, data } envelope into the profile signal', async () => {
            spyOn(
                restaurantProfileApi,
                'apiV1RestaurantsMeProfileGetRaw'
            ).and.resolveTo(
                rawResponse({ success: true, data: { name: 'Green Garden' } })
            );

            const profile = await service.loadProfile();

            expect(profile?.name).toBe('Green Garden');
            expect(service.profile()?.name).toBe('Green Garden');
        });

        it('tolerates a bare (un-enveloped) body', async () => {
            spyOn(
                restaurantProfileApi,
                'apiV1RestaurantsMeProfileGetRaw'
            ).and.resolveTo(rawResponse({ name: 'Bare' }));

            const profile = await service.loadProfile();

            expect(profile?.name).toBe('Bare');
        });
    });

    describe('saveProfile', () => {
        it('sends an UpdateRestaurantProfileRequest and reflects it in the signal', async () => {
            const put = spyOn(
                restaurantProfileApi,
                'apiV1RestaurantsMeProfilePut'
            ).and.resolveTo(undefined as any);

            await service.saveProfile({
                name: 'Updated',
                address: '1 Main St',
            });

            expect(put).toHaveBeenCalledWith({
                updateRestaurantProfileRequest: {
                    name: 'Updated',
                    address: '1 Main St',
                },
            });
            expect(service.profile()?.name).toBe('Updated');
            expect(service.profile()?.address).toBe('1 Main St');
        });
    });
});
