# Phase 1 Data Model: Restaurant Onboarding & Profile

Client-side view/DTO shapes. Request bodies reuse the generated models; GET responses are
declared locally in `restaurant-profile.types.ts` because the generated client types them as
`void` (backend OpenAPI omits response schemas). All persistence is server-side.

## Entity: RestaurantProfile

The restaurant's business identity and operating details.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | Business name. Non-empty. |
| `address` | string \| null | no | Business address (free text). |
| `contactPerson` | string \| null | no | Named contact. |
| `pickupStart` | string \| null | no | `HH:mm:ss` time-of-day; receiving-window start. |
| `pickupEnd` | string \| null | no | `HH:mm:ss`; receiving-window end. |
| `businessLicenseUrl` | string \| null | no | Hosted image URL (Cloudinary `secure_url`). |

- **Write model**: `UpdateRestaurantProfileRequest` (generated) — exact field parity.
- **Read**: `GET /api/v1/restaurants/me/profile` → provisional `RestaurantProfileView` (same
  fields; unwrapped from `{ success, data }`).
- **Validation**:
  - `name` required, trimmed non-empty.
  - Receiving window: if either `pickupStart` or `pickupEnd` is set, both must be set and
    `pickupEnd` strictly after `pickupStart` (`pickup-window.validator.ts`).
  - `businessLicenseUrl` set only via a successful upload; never free-typed.

## Entity: DeliveryAddress

A place an order can be delivered to.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | (read) | Server-assigned; present on list/read, absent on create. |
| `addressLine` | string | yes | Street address. Non-empty. |
| `recipientName` | string \| null | no | Person receiving. |
| `phone` | string \| null | no | Contact phone. |
| `latitude` | number \| null | no | Geographic point (via LocationPicker). |
| `longitude` | number \| null | no | Paired with latitude. |
| `isDefault` | boolean | no | At most one default per restaurant. |

- **Write model**: `DeliveryAddressRequest` (generated) for create (`POST`) and update (`PUT`).
- **Read**: `GET /api/v1/restaurants/me/delivery-addresses` → provisional
  `DeliveryAddressView[]` (adds server `id`).
- **Validation**:
  - `addressLine` required, trimmed non-empty.
  - `recipientName`, `phone` — recommended; validated as non-empty when provided (phone format
    kept lenient; VN numbers vary).
  - `latitude`/`longitude` — optional but set together when the picker is used.
- **Invariant**: at most one `isDefault: true`. Server-owned; client re-lists after any
  mutation that can change the default (set-default, add-with-default, delete-default).
- **State on delete-of-default**: after deleting the current default, the client re-lists and
  renders whatever the server returns as authoritative (either no default or a reassigned one).

## Entity: ApprovalStatus (read-only, external)

Owned by the server; surfaced through `AuthService`/`UserService`, not re-fetched here.

- **Type**: `'pending' | 'approved' | 'rejected'` (`user.types.ts`).
- **UI mapping**:
  - `approved` → no gate; normal ordering allowed elsewhere.
  - `pending` → inline explanation "awaiting admin approval"; ordering unavailable.
  - `rejected` (or any non-approved/unknown) → inline explanation; ordering unavailable.
- **No write path** in this feature.

## Entity: BusinessLicenseUpload (transient)

Not persisted as an entity; a transient flow producing a URL.

| Field | Type | Notes |
|-------|------|-------|
| `file` | File | Chosen image (client-only). |
| `secureUrl` | string | Cloudinary result → stored into `RestaurantProfile.businessLicenseUrl`. |

- **Signature source**: `POST /api/v1/restaurants/me/business-license/upload-signature`.
- **Failure**: on any failure, keep the previously stored `businessLicenseUrl` unchanged.

## Relationships

- One `RestaurantProfile` per restaurant account (1:1, keyed by "me"/token).
- One restaurant → zero-or-more `DeliveryAddress` (1:N); ≤1 default.
- `ApprovalStatus` is a scalar attribute of the account, read-only here.
- `BusinessLicenseUpload` feeds `RestaurantProfile.businessLicenseUrl`.
