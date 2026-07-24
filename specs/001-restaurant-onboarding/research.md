# Phase 0 Research: Restaurant Onboarding & Profile

All open questions were resolvable from the existing codebase and specs; none remain as
NEEDS CLARIFICATION. Findings below drive the data model, contracts, and tasks.

## R1 — Approval-status vocabulary (spec said PENDING_APPROVAL/APPROVED/SUSPENDED)

- **Decision**: Use the vocabulary already in the client — `ApprovalStatus = 'pending' |
  'approved' | 'rejected'` (`src/app/core/user/user.types.ts`). The profile screen reads the
  status from `AuthService`/`UserService` (already populated on load), not from a fresh call.
- **Rationale**: `AuthService._fetchApprovalStatus()` already calls
  `restaurantProfileApi.apiV1RestaurantsMeApprovalStatusGetRaw()`, lowercases `data.status`,
  and maps unknown → `pending`. The Postman collection's `PENDING_APPROVAL/APPROVED/SUSPENDED`
  are variable labels, not the response contract; the live client normalizes to the three
  lowercase states. Duplicating the fetch would risk drift.
- **Handling SUSPENDED**: The suspend/reactivate endpoints exist (admin, folder 90), but the
  restaurant-facing status feed currently normalizes anything non-standard to `pending`. The
  UI will render an explanation per state and treat any not-`approved` state as "ordering
  unavailable", so a future `suspended`/`rejected` value degrades safely without a code change.
- **Alternatives considered**: Re-fetch approval status inside the feature service — rejected
  (redundant with `AuthService`, causes two sources of truth). Introduce a `suspended` enum
  member now — deferred (no restaurant-facing endpoint emits it yet; adding an unused state
  would be speculative).
- **Spec impact**: `spec.md` wording (PENDING_APPROVAL/APPROVED/SUSPENDED) is treated as the
  business intent; the implementation maps it to `pending/approved/rejected` and shows a
  generic "account not active" explanation for any non-approved state.

## R2 — Data access & response typing

- **Decision**: Add `RestaurantProfileService` wrapping `restaurantProfileApi`, following
  `CatalogService`/`CatalogAdminService`: call the generated typed methods for requests, use
  the `*Raw` methods + a local `unwrap<T>()` for the GET responses (which the generator types
  as `void` because the backend OpenAPI omits response schemas), and declare provisional
  response interfaces in `restaurant-profile.types.ts`.
- **Rationale**: This is the established, constitution-compliant pattern in the repo; keeps
  strict typing with no `any` while the backend response schemas are unpublished.
- **Alternatives considered**: Hand-rolled `HttpClient` calls — rejected (bypasses the shared
  base URL, bearer, and 401/403/5xx handling in `apiConfiguration`).

## R3 — Business-license image upload

- **Decision**: Reuse the Cloudinary signed-upload flow. Mint a signature via
  `restaurantProfileApi.apiV1RestaurantsMeBusinessLicenseUploadSignaturePostRaw()`, POST the
  file to Cloudinary, and store the returned `secure_url` in `businessLicenseUrl` on the next
  profile save — identical in shape to `CatalogAdminService.uploadProductImage()`.
- **Rationale**: Same signed-upload contract; a single tested pattern already exists to copy.
- **Alternatives considered**: Direct multipart to the backend — rejected (no such endpoint;
  the backend only issues a signature).
- **Dependency note**: Requires configured Cloudinary credentials (a documented manual
  prerequisite, folder 90.14). The UI must handle a missing signature / failed upload
  gracefully and leave any existing license unchanged.

## R4 — Delivery-address geographic point

- **Decision**: Capture `latitude`/`longitude` with the existing `LocationPickerComponent`
  (`src/app/core/maps/location-picker.component.ts`), binding its required `latControl`/
  `lngControl` FormControls into the address editor form.
- **Rationale**: Component already exists and is the project's standard place/point picker
  (Goong). No new mapping code.
- **Alternatives considered**: Free-text lat/lng inputs — rejected (poor UX, error-prone);
  the model allows null coordinates, so the picker is used but coordinates are optional.

## R5 — Single-default-address invariant

- **Decision**: Enforce "at most one default" primarily server-side (the write endpoints own
  it); the client optimistically reflects the new default and then reconciles with a re-list
  after any set-default / add-as-default / delete-default action.
- **Rationale**: The server is authoritative (BR-AUTH-4); a re-list after mutation keeps the
  list consistent without the client trying to out-guess server rules.
- **Alternatives considered**: Purely client-side toggling without re-list — rejected (drifts
  from server truth if the backend reassigns defaults on delete).

## R6 — Route, guard, and navigation placement

- **Decision**: Add `/profile` as a child of the existing storefront area
  (`OptionalAuthGuard`, `layout: 'enterprise'`) in `app.routes.ts`, lazy-loading
  `modules/restaurant/profile.routes.ts`. Gate visibility/access to the restaurant role
  (nav item `roles: ['restaurant']`; the component redirects/blocks non-restaurants). Wire the
  already-present "Profile" button in `user.component.html` to `routerLink="/profile"`.
- **Rationale**: SITEMAP places `/profile` (M2) in the restaurant enterprise area; the nav
  system gates by role via the existing `roles` field; the user menu already has an unwired
  Profile entry.
- **Alternatives considered**: A dedicated `roleGuard(['restaurant'])` route branch like
  `/admin` — deferred; the storefront area already restores the session and drives the
  enterprise chrome, and role visibility is handled by the nav `roles` field, so a separate
  guarded branch is unnecessary for a single self-service page.

## R7 — Approval gate on ordering

- **Decision**: Reuse `ApprovalBannerComponent` on the profile screen for non-approved
  accounts (as `CatalogComponent` already does) and rely on the existing approval gating that
  hides/disables ordering actions elsewhere; this feature adds no new ordering surface.
- **Rationale**: Gate already implemented and reused across the storefront; consistency.
- **Alternatives considered**: A bespoke banner — rejected (duplicates existing component).
