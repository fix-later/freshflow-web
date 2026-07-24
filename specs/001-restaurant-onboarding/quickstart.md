# Quickstart: Restaurant Onboarding & Profile

How to build, wire, and verify the `/profile` feature. Assumes the standard dev setup
(`npm install`, a reachable backend via `.env` `API_BASE_URL`, Node 24).

## Build order (matches tasks.md once generated)

1. **Types** — `src/app/modules/restaurant/restaurant-profile.types.ts`: `RestaurantProfileView`,
   `DeliveryAddressView`, `BusinessLicenseSignature` (see contracts/).
2. **Service** — `restaurant-profile.service.ts`: signal-backed wrapper over
   `restaurantProfileApi` with `unwrap<T>()`; methods `loadProfile`, `saveProfile`,
   `listAddresses`, `addAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress`
   (re-lists after default-changing mutations), `uploadLicense(file)` (Cloudinary signed flow).
3. **Validator** — `business-profile/pickup-window.validator.ts` + spec: end strictly after
   start; both-or-neither.
4. **Components** (standalone, signals, OnPush):
   - `business-profile/business-profile-form.component` — profile fields + license upload +
     `ApprovalBannerComponent` for non-approved accounts.
   - `delivery-addresses/delivery-address-list.component` — list, set-default, delete.
   - `delivery-addresses/delivery-address-editor.component` — add/edit form using
     `LocationPickerComponent` for lat/lng.
   - `profile.component` — shell hosting the two sections.
5. **Route** — `profile.routes.ts`; register lazily at `/profile` under the storefront area in
   `app.routes.ts`.
6. **Nav + menu** — add nav item `id: 'profile'`, `roles: ['restaurant']` in
   `navigation.data.ts`; set `routerLink="/profile"` on the Profile button in
   `user.component.html`.
7. **i18n** — vi + en keys under a `restaurantProfile` Transloco scope for every label, hint,
   validation message, and toast.

## Manual verification (happy path — mirrors Postman folder 04)

1. Sign in as a restaurant (`restaurant+*@freshflow.local`).
2. Open the user menu → **Profile** (or navigate to `/profile`).
3. Confirm the approval banner shows for a `pending` account and ordering stays gated.
4. Fill business name, address, contact, pickup window (e.g. 08:00–18:00); save; reload; values
   persist.
5. Try an invalid window (end ≤ start) → inline error, save blocked.
6. Upload a business-license image (needs Cloudinary config) → thumbnail shows; save; reload.
7. Add a delivery address (address line, recipient, phone, pick a point) → appears in list.
8. Mark it default; add a second; switch default → only one default remains.
9. Edit then delete an address → list stays consistent; deleting the default leaves a
   consistent state.

## Automated checks

- `npm test` — unit specs (pickup-window validator, envelope unwrap, default-address
  reconciliation).
- `npm run precheck` — lint → Prettier → tests → prod build (the merge gate). Must be green.

## Definition of done

- All FR-001..FR-012 satisfied; SC-001..SC-005 demonstrable via the steps above.
- No `any`; no hardcoded user-facing strings; `/profile` lazy-loaded; `precheck` green.
