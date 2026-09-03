import { inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { extractList } from 'app/core/api/envelope';
import { UserService } from 'app/core/user/user.service';
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
    private readonly _userService = inject(UserService);

    private readonly _profile = signal<RestaurantProfileView | null>(null);
    private readonly _deliveryAddresses = signal<DeliveryAddressView[]>([]);

    /** Whose profile the cache currently holds. */
    private _cachedUserId: string | null = null;

    constructor() {
        // This cache belongs to an account, and it holds the id every
        // `{restaurantId}` endpoint is called with. Left standing across a
        // sign-in it points the new account's credit, order history and
        // scheduled orders at the previous restaurant — which the backend
        // rightly refuses (403 "credit is not accessible"), so both simply
        // vanish. The cache follows the session, not the tab.
        this._userService.user$.pipe(takeUntilDestroyed()).subscribe((user) => {
            const id = user?.id ?? null;
            if (id === this._cachedUserId) {
                return;
            }
            this._cachedUserId = id;
            this.reset();
        });
    }

    /** Forget everything read for the previous account. */
    reset(): void {
        this._profile.set(null);
        this._deliveryAddresses.set([]);
    }

    /** Latest loaded business profile, or `null` before the first load. */
    readonly profile = this._profile.asReadonly();
    /** Latest loaded saved delivery addresses, or `[]` before the first load. */
    readonly deliveryAddresses = this._deliveryAddresses.asReadonly();

    /**
     * The signed-in restaurant's own id, resolved from
     * `GET /restaurants/me/profile` and cached for the session.
     *
     * It is **not** the user id: `/profile/me` answers `e85656…` while the
     * restaurant is `e354de…`, and the `{restaurantId}` endpoints (credit,
     * scheduled orders) reject the wrong one with 404/403.
     */
    async restaurantId(): Promise<string> {
        const cached = this._profile()?.restaurantId;
        if (cached) {
            return cached;
        }
        const id = (await this.loadProfile())?.restaurantId;
        if (!id) {
            throw new Error('Restaurant profile carries no restaurantId');
        }
        return id;
    }

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
     * The saved tax profile. `PUT .../tax-profile` has no matching GET, but
     * `GET .../profile` returns the stored values under its own names, so the
     * form opens filled in instead of blank.
     */
    async loadTaxProfile(): Promise<UpdateTaxProfileRequest> {
        const profile = this._profile() ?? (await this.loadProfile());
        return {
            taxCode: profile?.taxCode ?? null,
            legalName: profile?.invoiceLegalName ?? null,
            address: profile?.invoiceAddress ?? null,
            email: profile?.invoiceEmail ?? null,
        };
    }

    /** Persist the restaurant's tax profile. */
    async saveTaxProfile(value: UpdateTaxProfileRequest): Promise<void> {
        await restaurantProfileApi.apiV1RestaurantsMeTaxProfilePut({
            updateTaxProfileRequest: value,
        });
        // Keep the cached profile in step so reopening the form shows the
        // values just saved rather than the ones it was opened with.
        const current = this._profile();
        if (current) {
            this._profile.set({
                ...current,
                taxCode: value.taxCode ?? null,
                invoiceLegalName: value.legalName ?? null,
                invoiceAddress: value.address ?? null,
                invoiceEmail: value.email ?? null,
            });
        }
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
