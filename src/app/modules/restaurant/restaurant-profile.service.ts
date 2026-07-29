import { Injectable, signal } from '@angular/core';
import { extractList } from 'app/core/api/envelope';
import {
    DeliveryAddressRequest,
    restaurantProfileApi,
    UpdateRestaurantProfileRequest,
    UpdateTaxProfileRequest,
} from 'contract';
import {
    DeliveryAddressView,
    RestaurantProfileView,
} from './restaurant-profile.types';

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
    private readonly _deliveryAddresses = signal<DeliveryAddressView[]>([]);

    /** Latest loaded business profile, or `null` before the first load. */
    readonly profile = this._profile.asReadonly();
    /** Latest loaded saved delivery addresses, or `[]` before the first load. */
    readonly deliveryAddresses = this._deliveryAddresses.asReadonly();

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

    /**
     * Persist the restaurant's tax profile. Write-only — the spec has no
     * matching GET, so there is nothing to load into a form on open.
     */
    async saveTaxProfile(value: UpdateTaxProfileRequest): Promise<void> {
        await restaurantProfileApi.apiV1RestaurantsMeTaxProfilePut({
            updateTaxProfileRequest: value,
        });
    }

    /** Load the restaurant's saved delivery addresses into the `deliveryAddresses` signal. */
    async loadDeliveryAddresses(): Promise<DeliveryAddressView[]> {
        const res =
            await restaurantProfileApi.apiV1RestaurantsMeDeliveryAddressesGetRaw();
        const addresses = extractList<DeliveryAddressView>(
            await res.raw.json()
        );
        this._deliveryAddresses.set(addresses);
        return addresses;
    }

    /** The default saved address, or the first saved one if none is marked default. */
    defaultDeliveryAddress(): DeliveryAddressView | null {
        const addresses = this._deliveryAddresses();
        return addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
    }

    async addDeliveryAddress(value: DeliveryAddressRequest): Promise<void> {
        await restaurantProfileApi.apiV1RestaurantsMeDeliveryAddressesPost({
            deliveryAddressRequest: value,
        });
        await this.loadDeliveryAddresses();
    }

    async updateDeliveryAddress(
        id: string,
        value: DeliveryAddressRequest
    ): Promise<void> {
        await restaurantProfileApi.apiV1RestaurantsMeDeliveryAddressesIdPut({
            id,
            deliveryAddressRequest: value,
        });
        await this.loadDeliveryAddresses();
    }

    async removeDeliveryAddress(id: string): Promise<void> {
        await restaurantProfileApi.apiV1RestaurantsMeDeliveryAddressesIdDelete({
            id,
        });
        await this.loadDeliveryAddresses();
    }
}
