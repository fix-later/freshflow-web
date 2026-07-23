# Contract: UI ↔ RestaurantProfileApi

The feature consumes only the existing generated `restaurantProfileApi` singleton
(`import { restaurantProfileApi } from 'contract'`). No new backend endpoints. All responses
use the `{ success, data }` envelope; unwrap before use. Bearer/base-URL/error handling come
from the shared `apiConfiguration`.

## Operations used

| UI action | Generated method | HTTP | Request model | Response (provisional) |
|-----------|------------------|------|---------------|------------------------|
| Load business profile | `apiV1RestaurantsMeProfileGet` / `...GetRaw` | GET `/api/v1/restaurants/me/profile` | — | `RestaurantProfileView` |
| Save business profile | `apiV1RestaurantsMeProfilePut` | PUT `/api/v1/restaurants/me/profile` | `UpdateRestaurantProfileRequest` | 200 |
| List delivery addresses | `apiV1RestaurantsMeDeliveryAddressesGet` / `...GetRaw` | GET `/api/v1/restaurants/me/delivery-addresses` | — | `DeliveryAddressView[]` |
| Add delivery address | `apiV1RestaurantsMeDeliveryAddressesPost` | POST `/api/v1/restaurants/me/delivery-addresses` | `DeliveryAddressRequest` | created; capture `id` |
| Edit delivery address | `apiV1RestaurantsMeDeliveryAddressesIdPut` | PUT `/api/v1/restaurants/me/delivery-addresses/{id}` | `DeliveryAddressRequest` | 200 |
| Delete delivery address | `apiV1RestaurantsMeDeliveryAddressesIdDelete` | DELETE `/api/v1/restaurants/me/delivery-addresses/{id}` | — | 200 |
| Mint license upload signature | `apiV1RestaurantsMeBusinessLicenseUploadSignaturePostRaw` | POST `/api/v1/restaurants/me/business-license/upload-signature` | — | Cloudinary signed params |
| Approval status | (via `AuthService`) `apiV1RestaurantsMeApprovalStatusGetRaw` | GET `/api/v1/restaurants/me/approval-status` | — | `{ status }` → normalized enum |

Set-default is expressed through the create/edit request's `isDefault: true` (there is no
dedicated set-default endpoint); after any default-changing mutation the client re-lists.

## Provisional response types (`restaurant-profile.types.ts`)

```ts
export interface RestaurantProfileView {
    name: string;
    address?: string | null;
    contactPerson?: string | null;
    pickupStart?: string | null;   // 'HH:mm:ss'
    pickupEnd?: string | null;     // 'HH:mm:ss'
    businessLicenseUrl?: string | null;
}

export interface DeliveryAddressView {
    id: string;
    addressLine: string;
    recipientName?: string | null;
    phone?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    isDefault?: boolean;
}

export interface BusinessLicenseSignature {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
}
```

These are provisional (the backend OpenAPI does not yet publish GET response schemas). When the
backend adds them and the client is regenerated, replace these with the generated models.

## Error handling contract

- `401` → handled globally by `apiConfiguration` (session refresh / sign-in).
- `403` → surface a permission message; do not crash (RBAC is server-authoritative, BR-AUTH-4).
- `4xx/5xx` on save → keep the user's entered form values and show a retryable error.
- Read failure → retryable empty/error state; no data loss.
- Upload failure → previously stored `businessLicenseUrl` left unchanged.
