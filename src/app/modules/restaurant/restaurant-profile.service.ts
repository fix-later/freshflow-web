import { Injectable, signal } from '@angular/core';
import { restaurantProfileApi, UpdateRestaurantProfileRequest } from 'contract';
import { RestaurantProfileView } from './restaurant-profile.types';

/** Unwraps the `{ success, data }` envelope, tolerating a bare body too. */
function unwrap<T>(body: unknown): T | undefined {
    if (body && typeof body === 'object' && 'data' in body) {
        return (body as { data?: T }).data;
    }
    return body as T;
}

/**
 * Data access for the restaurant self-service onboarding area, backed by the
 * generated `restaurantProfileApi` singleton (base URL + bearer + 401/403/5xx
 * handling come from the shared `apiConfiguration`).
 *
 * Reads use the generated `*Raw` methods + {@link unwrap} because the backend
 * OpenAPI does not yet publish response schemas (the typed reads are `void`);
 * writes use the generated request models. See
 * `specs/001-restaurant-onboarding/contracts/restaurant-profile-api.md`.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantProfileService {
    private readonly _profile = signal<RestaurantProfileView | null>(null);

    /** Latest loaded business profile, or `null` before the first load. */
    readonly profile = this._profile.asReadonly();

    /** Load the restaurant business profile into the `profile` signal. */
    async loadProfile(): Promise<RestaurantProfileView | null> {
        const res =
            await restaurantProfileApi.apiV1RestaurantsMeProfileGetRaw();
        const profile =
            unwrap<RestaurantProfileView>(await res.raw.json()) ?? null;
        this._profile.set(profile);
        return profile;
    }

    /** Persist the restaurant business profile. */
    async saveProfile(value: UpdateRestaurantProfileRequest): Promise<void> {
        await restaurantProfileApi.apiV1RestaurantsMeProfilePut({
            updateRestaurantProfileRequest: value,
        });
        // Reflect the saved values optimistically; a reload can re-sync later.
        this._profile.set({
            ...(this._profile() ?? { name: value.name }),
            ...value,
        });
    }
}
