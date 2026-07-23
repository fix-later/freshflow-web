# Implementation Plan: Restaurant Onboarding & Profile

**Branch**: `001-restaurant-onboarding` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-restaurant-onboarding/spec.md`

## Summary

Deliver the restaurant-facing self-service profile area at route `/profile` (M2) inside the
enterprise/storefront chrome. It lets an authenticated restaurant view and edit its business
profile (name, address, contact person, receiving/pickup window, business-license image),
manage its delivery addresses (list / add / edit / delete / set-default with a single-default
invariant), and see its approval status with the BR-AUTH-1 ordering gate explained inline.

The backend surface already exists as the generated `RestaurantProfileApi` (Postman folder 04),
approval status is already fetched into the user signal by `AuthService`, and an
`ApprovalBannerComponent` and `LocationPickerComponent` are already in the codebase. This
feature is therefore almost entirely a new lazy-loaded Angular feature module plus one route,
one nav entry, and Transloco strings — reusing existing services and the signed-upload pattern
rather than adding new infrastructure.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Angular 22 (standalone, signals, new control flow)

**Primary Dependencies**: Angular Material 22 + Fuse template; Transloco (i18n); generated
`typescript-fetch` OpenAPI client (`contract` barrel → `restaurantProfileApi`); Reactive Forms;
Goong maps (`LocationPickerComponent`) for the address point; Cloudinary signed upload (existing
pattern) for the license image.

**Storage**: None client-side beyond Angular signals; all persistence is via the backend
`/api/v1/restaurants/me/*` endpoints.

**Testing**: Jasmine + Karma unit tests (validators, service envelope unwrap, default-address
invariant). `npm run precheck` (lint → Prettier → tests → prod build) is the merge gate.

**Target Platform**: Modern evergreen browsers; responsive within the enterprise layout.

**Project Type**: Web application (single Angular frontend; backend is external and fixed).

**Performance Goals**: Feature stays lazy-loaded; per-component styles ≤ 90 KB; no measurable
regression to the ≤ 3 MB warning / ≤ 5 MB error initial-bundle budget.

**Constraints**: Strict TS, no `any` in new code; all user-facing text bilingual vi/en; RBAC
stays server-authoritative (handle `403` gracefully); reuse the `{ success, data }` envelope
unwrap convention.

**Scale/Scope**: One route, one feature module (~3 sub-views: profile form, address list/editor,
license upload), one service, one nav item, two Transloco scopes (vi/en). Single-restaurant data.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Angular-First, Signal-Driven | PASS | Standalone components, signals, lazy route. No NgModules. |
| II. Real-Time by Default | PASS (N/A) | Profile/addresses are user-edited config, not live-pushed data. Approval status is read on load and already refreshed by `AuthService`; no SignalR channel required. |
| III. Type Safety (NON-NEGOTIABLE) | PASS | Generated request models (`UpdateRestaurantProfileRequest`, `DeliveryAddressRequest`) typed; local response types declared for the `void`-typed GETs (same approach as `CatalogService`). No `any`. |
| IV. Test Before Merge | PASS | Unit tests for validators + default-address invariant + envelope unwrap; `precheck` gate. |
| V. Bilingual UX | PASS | All labels/errors via Transloco vi/en; no hardcoded strings. |
| VI. Performance Budget | PASS | Lazy-loaded feature; Material components; styles under budget. |

**Domain facts honored**: Self-registration + approval gate (BR-AUTH-1) — profile is editable
while `pending`/`rejected`, but ordering stays disabled and explained. B2B credit is a separate
feature (no checkout here). No invented business rules, thresholds, or endpoints.

**Result**: No violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-restaurant-onboarding/
├── plan.md              # This file
├── spec.md              # Feature spec
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── restaurant-profile-api.md   # UI ↔ RestaurantProfileApi operation map
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/app/modules/restaurant/                 # NEW lazy feature module (route: /profile)
├── profile.routes.ts                        # lazy route config for the /profile area
├── restaurant-profile.service.ts            # data access over restaurantProfileApi (+ envelope unwrap, upload)
├── restaurant-profile.types.ts              # local response/view types (GETs are void in the generated client)
├── profile.component.ts|html|scss           # shell: tabs/sections — Business profile · Delivery addresses
├── business-profile/
│   ├── business-profile-form.component.ts|html   # name/address/contact/pickup window + license upload
│   └── pickup-window.validator.ts                # end-after-start reactive-form validator (+ spec)
└── delivery-addresses/
    ├── delivery-address-list.component.ts|html   # list + set-default + delete
    └── delivery-address-editor.component.ts|html # add/edit dialog/form (uses LocationPickerComponent)

src/app/app.routes.ts                        # EDIT: add `/profile` child under the storefront (OptionalAuthGuard) area, restaurant-gated
src/app/core/navigation/navigation.data.ts   # EDIT: add storefront nav item id 'profile', roles: ['restaurant']
src/app/layout/common/user/user.component.html  # EDIT: wire the existing "Profile" menu button to routerLink="/profile"

src/assets/i18n/ (or existing Transloco location)   # EDIT: vi/en keys under a `restaurantProfile` scope
```

**Structure Decision**: Single Angular frontend (Option 2, frontend only — the backend is a
fixed external service consumed through the generated client). The feature is a new
self-contained lazy module `src/app/modules/restaurant/` mirroring the existing module
conventions (`catalog`, `admin/catalog`): a thin signal-based service wrapping the generated
API with envelope unwrap, standalone components, and a lazy `*.routes.ts`. Reused, not rebuilt:
`restaurantProfileApi`, `AuthService.approvalStatus`, `ApprovalBannerComponent`,
`LocationPickerComponent`, and the Cloudinary signed-upload flow from `CatalogAdminService`.

## Complexity Tracking

No constitution violations — section intentionally empty.
