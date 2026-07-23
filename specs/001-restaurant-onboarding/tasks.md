---

description: "Task list for Restaurant Onboarding & Profile"
---

# Tasks: Restaurant Onboarding & Profile

**Input**: Design documents from `specs/001-restaurant-onboarding/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/restaurant-profile-api.md, quickstart.md

**Tests**: Included — the constitution mandates "Test Before Merge" (Principle IV) and the plan
names specific unit specs (pickup-window validator, service envelope unwrap, default-address
reconciliation). Only these targeted specs are written; no full contract-test suite.

**Organization**: Tasks are grouped by user story (US1 P1, US2 P2, US3 P3) so each story is an
independently testable, deployable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (setup, foundational, polish carry no story label)
- All paths are repository-relative.

## Path map (from plan.md)

- Feature module: `src/app/modules/restaurant/`
- i18n: `public/i18n/en.json`, `public/i18n/vi.json` (namespace `restaurantProfile`)
- Route registration: `src/app/app.routes.ts`
- Navigation: `src/app/core/navigation/navigation.data.ts`
- User menu: `src/app/layout/common/user/user.component.html`
- Reused: `contract` (`restaurantProfileApi`), `app/core/auth` (`AuthService`,
  `ApprovalBannerComponent`), `app/core/maps/location-picker.component`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffolding for the feature module and i18n namespace.

- [X] T001 [P] Create the feature folder structure `src/app/modules/restaurant/` with empty
  subfolders `business-profile/` and `delivery-addresses/` (add a `.gitkeep` if needed).
- [X] T002 [P] Add an empty `"restaurantProfile": {}` namespace to both `public/i18n/en.json`
  and `public/i18n/vi.json` as the home for this feature's keys.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The data layer, route, shell, and navigation that every user story renders inside.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `src/app/modules/restaurant/restaurant-profile.types.ts` with
  `RestaurantProfileView`, `DeliveryAddressView`, and `BusinessLicenseSignature` exactly as
  specified in `contracts/restaurant-profile-api.md` (strict types, no `any`).
- [X] T004 Create `src/app/modules/restaurant/restaurant-profile.service.ts` skeleton:
  `@Injectable({ providedIn: 'root' })`, signals for `profile` and `addresses`, a private
  `unwrap<T>()` envelope helper (mirroring `CatalogService`), and typed method stubs
  `loadProfile`, `saveProfile`, `listAddresses`, `addAddress`, `updateAddress`,
  `deleteAddress`, `setDefaultAddress`, `uploadLicense`. Depends on T003.
- [X] T005 [P] Create the shell `src/app/modules/restaurant/profile.component.ts` +
  `profile.component.html` + `profile.component.scss` (standalone, OnPush, signals,
  `TranslocoModule`) with two clearly separated sections — "Business profile" and "Delivery
  addresses" — as empty host slots for now.
- [X] T006 Create `src/app/modules/restaurant/profile.routes.ts` exporting a default lazy route
  that loads `ProfileComponent`. Depends on T005.
- [X] T007 Register `/profile` as a child of the storefront area (the `OptionalAuthGuard` /
  `layout: 'enterprise'` block) in `src/app/app.routes.ts`, lazy-loading
  `app/modules/restaurant/profile.routes`. Depends on T006.
- [X] T008 [P] Add a storefront navigation item `{ id: 'profile', roles: ['restaurant'],
  area: 'storefront', type: 'basic', link: '/profile' }` (title key/text vi/en) to
  `src/app/core/navigation/navigation.data.ts`.
- [X] T009 [P] Wire the existing "Profile" menu button to `routerLink="/profile"` in
  `src/app/layout/common/user/user.component.html`.

**Checkpoint**: Navigating to `/profile` renders the empty two-section shell for a restaurant.

---

## Phase 3: User Story 1 - Business profile + approval gate (Priority: P1) 🎯 MVP

**Goal**: A restaurant can view and edit its business profile (name, address, contact, receiving
window) with validation, see its approval status inline, and have ordering gated while not
approved.

**Independent Test**: Sign in as a restaurant, open `/profile`, edit every business field, save,
reload → values persist; an invalid receiving window is blocked; a `pending` account shows the
approval banner.

### Tests for User Story 1

- [X] T010 [P] [US1] Unit spec `src/app/modules/restaurant/business-profile/pickup-window.validator.spec.ts`:
  both-or-neither, end-after-start, valid pass-through.
- [X] T011 [P] [US1] Unit spec `src/app/modules/restaurant/restaurant-profile.service.spec.ts`
  (profile portion): `loadProfile` unwraps `{ success, data }`; `saveProfile` sends an
  `UpdateRestaurantProfileRequest`; read failure surfaces a retryable state.

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement
  `src/app/modules/restaurant/business-profile/pickup-window.validator.ts` (reactive-form
  cross-field validator: `pickupEnd` strictly after `pickupStart`; both required together).
- [X] T013 [US1] Implement `loadProfile()` and `saveProfile()` in `restaurant-profile.service.ts`
  over `restaurantProfileApi.apiV1RestaurantsMeProfileGet(Raw)` / `...ProfilePut`, unwrapping the
  envelope into `RestaurantProfileView`. Depends on T004.
- [X] T014 [US1] Implement
  `src/app/modules/restaurant/business-profile/business-profile-form.component.ts` +
  `.html`: reactive form (name required; address; contactPerson; pickupStart; pickupEnd) using
  the pickup-window validator, save with success/error toast (MatSnackBar), and embed
  `ApprovalBannerComponent` shown when `AuthService`/`UserService` approval status ≠ `approved`.
  Depends on T012, T013.
- [X] T015 [US1] Mount `<business-profile-form>` in the "Business profile" section of
  `profile.component.html`. Depends on T014.
- [X] T016 [US1] Add US1 i18n keys (field labels, hints, validation messages, save toasts,
  approval-state explanations) under `restaurantProfile` in both `public/i18n/en.json` and
  `public/i18n/vi.json`.

**Checkpoint**: US1 fully functional — the business profile is viewable, editable, validated,
and approval-gated. This is the MVP.

---

## Phase 4: User Story 2 - Manage delivery addresses (Priority: P2)

**Goal**: A restaurant can list, add, edit, delete delivery addresses and set exactly one
default, capturing a map point per address.

**Independent Test**: Add an address, mark default, edit it, add a second and switch default,
delete one → the list and single-default stay consistent after each action.

### Tests for User Story 2

- [ ] T017 [P] [US2] Extend `restaurant-profile.service.spec.ts` with the addresses portion:
  `listAddresses` unwrap; `addAddress`/`updateAddress` send `DeliveryAddressRequest`;
  `setDefaultAddress`/`deleteAddress` trigger a re-list so the client reflects server-owned
  default reconciliation.

### Implementation for User Story 2

- [ ] T018 [US2] Implement `listAddresses`, `addAddress`, `updateAddress`, `deleteAddress`,
  `setDefaultAddress` in `restaurant-profile.service.ts` over the generated
  `...DeliveryAddresses*` methods; re-list after any default-changing mutation. Depends on T004.
- [ ] T019 [P] [US2] Implement
  `src/app/modules/restaurant/delivery-addresses/delivery-address-editor.component.ts` + `.html`:
  add/edit reactive form (addressLine required; recipientName; phone; isDefault) using
  `LocationPickerComponent` bound to `latControl`/`lngControl`.
- [ ] T020 [US2] Implement
  `src/app/modules/restaurant/delivery-addresses/delivery-address-list.component.ts` + `.html`:
  render the address list, set-default, delete, and open the editor for add/edit. Depends on
  T018, T019.
- [ ] T021 [US2] Mount `<delivery-address-list>` in the "Delivery addresses" section of
  `profile.component.html`. Depends on T020.
- [ ] T022 [US2] Add US2 i18n keys (address fields, default badge, add/edit/delete actions,
  confirmation + toasts) under `restaurantProfile` in `public/i18n/en.json` and
  `public/i18n/vi.json`.

**Checkpoint**: US1 and US2 both work independently; addresses stay consistent with the server.

---

## Phase 5: User Story 3 - Business-license upload (Priority: P3)

**Goal**: A restaurant can upload a business-license image; it shows on the profile and is stored
with the business profile on save; failures leave the previous license unchanged.

**Independent Test**: Upload a license image, save, reload → the image is associated with the
profile; a failed upload leaves any existing license intact.

### Tests for User Story 3

- [ ] T023 [P] [US3] Extend `restaurant-profile.service.spec.ts` with `uploadLicense`: a missing
  signature or failed Cloudinary POST throws and does not alter the current
  `businessLicenseUrl`.

### Implementation for User Story 3

- [ ] T024 [US3] Implement `uploadLicense(file)` in `restaurant-profile.service.ts`: mint a
  signature via `restaurantProfileApi.apiV1RestaurantsMeBusinessLicenseUploadSignaturePostRaw()`,
  POST the file to Cloudinary, return `secure_url` (mirror
  `CatalogAdminService.uploadProductImage()`). Depends on T004.
- [ ] T025 [US3] Add a license upload control to `business-profile-form.component` (file input +
  thumbnail preview); on success set `businessLicenseUrl` in the form (persisted on profile
  save); on failure keep the existing value and show an error toast. Depends on T014, T024.
- [ ] T026 [US3] Add US3 i18n keys (upload label, choose/replace, uploading, success/error) under
  `restaurantProfile` in `public/i18n/en.json` and `public/i18n/vi.json`.

**Checkpoint**: All three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T027 [P] Verify strict typing (no `any`), no hardcoded user-facing strings, and OnPush +
  signals throughout the `src/app/modules/restaurant/` module.
- [ ] T028 [P] Confirm bilingual completeness: every `restaurantProfile` key exists in both
  `en.json` and `vi.json` with no missing/placeholder values.
- [ ] T029 Run the `quickstart.md` manual verification (folder-04 happy path) against a live
  backend.
- [ ] T030 Run `npm run precheck` (lint → Prettier → tests → production build) and ensure it is
  green.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup — BLOCKS all user stories. (T004→T003; T006→T005;
  T007→T006.)
- **User Stories (Phase 3–5)**: all require Phase 2. US1 is the MVP; US2 and US3 each depend only
  on the foundational service/shell, not on each other.
- **Polish (Phase 6)**: after the desired stories are complete.

### User story dependencies

- **US1 (P1)**: after Phase 2. No dependency on US2/US3.
- **US2 (P2)**: after Phase 2. Independent of US1 (renders in a separate shell section).
- **US3 (P3)**: after Phase 2; its UI attaches to the US1 business-profile form (T025 needs
  T014), so US3 is best done after US1. The service method (T024) is independent.

### Within each story

- Tests before implementation where listed; service methods before the components that call them;
  components before they are mounted in the shell.

### Parallel opportunities

- Setup: T001, T002 in parallel.
- Foundational: T003, T005, T008, T009 in parallel; T004/T006/T007 follow their deps.
- US1: T010, T011 (tests) parallel; T012 parallel with them.
- US2: T017 (test) and T019 (editor) parallel with T018 (service).
- Polish: T027, T028 parallel.

---

## Parallel Example: User Story 1

```text
# Tests + independent validator together:
Task: T010 pickup-window.validator.spec.ts
Task: T011 restaurant-profile.service.spec.ts (profile portion)
Task: T012 pickup-window.validator.ts
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & validate** the business
   profile + approval gate against a live restaurant account → demo.

### Incremental delivery

1. Setup + Foundational → shell reachable at `/profile`.
2. US1 → business profile (MVP) → demo.
3. US2 → delivery addresses → demo.
4. US3 → license upload → demo.
5. Polish → precheck green → merge.

---

## Notes

- [P] = different files, no incomplete-task dependency.
- Keep RBAC server-authoritative: hide/disable ordering while not approved, but still handle a
  server `403` gracefully.
- Commit after each task or logical group; stop at any checkpoint to validate a story.
- Total: 30 tasks — Setup 2, Foundational 7, US1 7, US2 6, US3 4, Polish 4.
