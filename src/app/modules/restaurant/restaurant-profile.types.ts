/**
 * Provisional response/view types for the restaurant onboarding feature.
 *
 * The generated OpenAPI client types the `GET /api/v1/restaurants/me/*` reads as
 * `void` (the backend spec documents them only as "200 OK"), so — as with
 * `CatalogService` — we call the generated `*Raw` methods and parse the body
 * against these local contracts, unwrapped from the `{ success, data }`
 * envelope. Request bodies still use the generated models
 * (`UpdateRestaurantProfileRequest`, `DeliveryAddressRequest`). Replace these
 * with generated models once the backend publishes the response schemas.
 *
 * See `specs/001-restaurant-onboarding/contracts/restaurant-profile-api.md`.
 */

/** Restaurant business profile (`GET/PUT /api/v1/restaurants/me/profile`). */
export interface RestaurantProfileView {
    /**
     * The restaurant's own id — **not** the signed-in user's id. Endpoints
     * that take a `{restaurantId}` path parameter (credit, scheduled orders)
     * need this one; passing the user id answers 404/403.
     */
    restaurantId?: string;
    name: string;
    address?: string | null;
    contactPerson?: string | null;
    /** Receiving-window start, `HH:mm:ss`. */
    pickupStart?: string | null;
    /** Receiving-window end, `HH:mm:ss`. */
    pickupEnd?: string | null;
    businessLicenseUrl?: string | null;
    /** Approval/activity state, e.g. `active`. */
    status?: string | null;
    // Tax profile — the spec publishes no GET for `PUT .../tax-profile`, but
    // the business-profile read returns the saved values, so the tax form can
    // open pre-filled instead of blank.
    taxCode?: string | null;
    invoiceLegalName?: string | null;
    invoiceAddress?: string | null;
    invoiceEmail?: string | null;
}

/** A saved delivery address (`GET /api/v1/restaurants/me/delivery-addresses`). */
export interface DeliveryAddressView {
    id: string;
    addressLine: string;
    recipientName?: string | null;
    phone?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    isDefault?: boolean;
}

/**
 * Signed Cloudinary upload params minted by
 * `POST /api/v1/restaurants/me/business-license/upload-signature`, mirroring the
 * product-image signature shape already consumed by `CatalogAdminService`.
 */
export interface BusinessLicenseSignature {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
}
