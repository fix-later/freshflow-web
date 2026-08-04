# Implementation Plan: Restaurant Onboarding Wizard & Completion Checklist

**Branch**: `feature/admin` (spec dir `003-restaurant-onboarding-wizard`) | **Date**: 2026-08-02
| **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-restaurant-onboarding-wizard/spec.md`

## Summary

Give a newly self-registered restaurant a guided path from "registered" to "reviewable". Today
feature 001's forms exist but nothing tells a restaurant what to fill in, so accounts sit
`PENDING_APPROVAL` with no visible next step.

This feature adds a lazy `/onboarding` route holding a four-step Material stepper — business
profile (with the licence upload), tax/billing, delivery address, review — that **embeds the
three existing profile-area form components rather than reimplementing them**, plus a
getting-started card on the `/profile` dashboard that derives its progress from saved data. An
incomplete restaurant is routed into the wizard at sign-in; it can leave at any point and keep
browsing, as BR-AUTH-1 entitles it to.

The work is deliberately thin: one new lazy feature folder, one shared completion-derivation
service, one card in an existing component, a three-line signature change to each of the three
reused forms, and new keys in two i18n files. No new endpoints, no new data, no new dependency.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`), Angular 22 (standalone, signals, new
control flow)

**Primary Dependencies**: Angular Material 22 — `MatStepperModule` is new to this codebase but
ships with the existing dependency; Transloco (i18n); the generated `typescript-fetch` client
(`contract` barrel → `restaurantProfileApi`); Reactive Forms; the existing
`LocationPickerComponent` (Goong maps) and Cloudinary signed-upload helper, both reached
transitively through the reused form components.

**Storage**: No new persistence. All feature data lives behind the existing
`/api/v1/restaurants/me/*` endpoints. The single piece of client-only state — whether the
restaurant dismissed the wizard this session — is held in `sessionStorage` keyed by user id
(see research R4 for why it cannot be server-side).

**Testing**: Jasmine + Karma unit tests over the completion-derivation rules (the one piece of
real logic), the session-scoped dismissal, and the step-advance-blocks-on-failed-save
behaviour. `npm run precheck` (lint → Prettier → tests → prod build) is the merge gate.

**Target Platform**: Modern evergreen browsers; the wizard is responsive and usable at phone
width, since a restaurant owner photographing a licence is plausibly on a phone.

**Project Type**: Web application — single Angular frontend against a fixed external backend.

**Performance Goals**: Feature stays lazy-loaded and off the initial bundle; the stepper is
imported only by the `/onboarding` chunk. No measurable regression to the ≤ 3 MB warning /
≤ 5 MB error initial-bundle budget; per-component styles ≤ 90 KB.

**Constraints**: Strict TS with no `any`; every user-facing string bilingual vi/en; RBAC stays
server-authoritative and `403` is handled gracefully; the wizard must never trap a pending
restaurant (FR-003 / BR-AUTH-1); the UI must never claim an item is complete that it cannot
verify (FR-021, spec Decision 2).

**Scale/Scope**: One route, one lazy feature folder (~4 wizard components + 1 card + 1
service), one edit to sign-in's landing logic, one edit to the profile dashboard, three
one-line signature changes, and new keys in two i18n files. Single-restaurant data throughout.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Angular-First, Signal-Driven | PASS | Standalone components, `signal`/`computed` state, lazy `onboarding.routes.ts`. No NgModules. Step index, completion states and progress are all signals. |
| II. Real-Time by Default | PASS (N/A) | Onboarding data is user-edited configuration, not pushed data. Approval status is read on load and already maintained by `AuthService`; no SignalR channel is warranted. The checklist reacts to local writes through the existing `RestaurantProfileService` signals, so it updates without reload (FR-018) without needing a socket. |
| III. Type Safety (NON-NEGOTIABLE) | PASS | Reuses the generated request models and the existing local view types (`RestaurantProfileView`, `DeliveryAddressView`). New types are a small discriminated set of setup-item ids and states. No `any`. |
| IV. Test Before Merge | PASS | Unit tests target the derivation rules, dismissal scope and save-gated advance; `precheck` gates the merge. |
| V. Bilingual UX | PASS | New `restaurantOnboarding` scope in `en.json` + `vi.json`; embedded forms reuse their existing translated labels. |
| VI. Performance Budget | PASS | Lazy chunk; Material components; the stepper is the only new Material module and is confined to that chunk. |

**Domain facts honoured**: Self-registration + approval gate (BR-AUTH-1) — the wizard is
escapable, ordering stays disabled throughout, and the review step states plainly that approval
is an administrator's decision. No credit or checkout surface is touched. No business rule,
endpoint or threshold is invented: the completeness threshold came from the product owner as
spec Decision 1, and the two backend gaps (no submit endpoint, unreadable tax profile) are
surfaced rather than worked around.

**Result**: No violations. Complexity Tracking not required.

**Post-design re-check (after Phase 1)**: Still PASS. The design added no NgModule, no new
dependency, no `any`, and no untranslated string. The one item worth restating is Principle III:
the setup-item model in [data-model.md](./data-model.md) is a closed union of four ids and two
states, deliberately narrow so an unhandled item is a compile error rather than a silent gap.

## Project Structure

### Documentation (this feature)

```text
specs/003-restaurant-onboarding-wizard/
├── plan.md              # This file
├── spec.md              # Feature spec (Decisions 1 & 2 resolved)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── onboarding-ui-contract.md   # component/service contracts + API operation map
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/app/modules/restaurant/onboarding/            # NEW lazy feature folder (route: /onboarding)
├── onboarding.routes.ts                          # lazy route, roleGuard(['restaurant'])
├── onboarding.component.ts|html                  # stepper shell: step index, progress, exit
├── review-step.component.ts|html                 # summary + what-happens-next + missing items
└── onboarding-step.contract.ts                   # tiny interface the reused forms satisfy

src/app/modules/restaurant/setup/                 # NEW shared completion logic (both surfaces)
├── setup-completion.service.ts                   # derives item states from saved data
├── setup-completion.service.spec.ts              # unit tests for the derivation rules
├── setup.types.ts                                # SetupItemId, SetupItemState, SetupProgress
└── setup-checklist.component.ts|html             # the getting-started card (US3)

# EDITED — existing files
src/app/app.routes.ts                             # add lazy '/onboarding' under the storefront area
src/app/modules/auth/sign-in/sign-in.component.ts # route an incomplete restaurant to /onboarding
src/app/modules/restaurant/dashboard/restaurant-dashboard.component.ts|html
                                                  # host the getting-started card
src/app/modules/restaurant/business-profile/business-profile-form.component.ts
src/app/modules/restaurant/tax-profile/tax-profile-form.component.ts
src/app/modules/restaurant/delivery-addresses/delivery-addresses.component.ts
                                                  # save(): Promise<void> → Promise<boolean>
public/i18n/en.json · public/i18n/vi.json         # new `restaurantOnboarding` scope
```

**Structure Decision**: Single Angular frontend. The feature splits into two folders on
purpose. `onboarding/` is the wizard — one route, one audience, entirely lazy. `setup/` holds
the completion logic and the checklist card, because those are consumed by **both** the wizard's
review step and the always-loaded profile dashboard; putting them under `onboarding/` would drag
the wizard chunk into the profile area. Both sit under the existing
`src/app/modules/restaurant/` module alongside `business-profile/`, `tax-profile/` and
`delivery-addresses/`, matching the conventions feature 001 established.

## Key Design Decisions

Full reasoning in [research.md](./research.md); the three that shape the work most:

1. **The licence is not a separate step** (R2). `businessLicenseUrl` is a field of the profile
   PUT, so a separate licence step would issue a second PUT that clobbers the first. The wizard
   keeps business + licence in one step; the checklist still tracks the licence as its own
   required item, derived independently. This is the single most important constraint to carry
   into implementation.
2. **The existing forms are reused, not rebuilt** (R3). All three already expose a public `form`
   and `save()`; the only gap is that `save()` cannot report failure. Widening it to
   `Promise<boolean>` is three lines each and breaks no caller, versus duplicating three
   reactive forms that would immediately start drifting.
3. **Auto-entry lives in sign-in, not a guard** (R5). `app.routes.ts` already documents that
   per-role landing is resolved in the auth components because that is where the role is known.
   A storefront guard would re-decide on every navigation and fight the user's browsing.

## Phase 1 Outputs

- [data-model.md](./data-model.md) — the setup-item model, the derivation rule for each state,
  and the progress computation.
- [contracts/onboarding-ui-contract.md](./contracts/onboarding-ui-contract.md) — the step
  contract the reused forms satisfy, the completion service's public surface, and the map from
  UI actions to `RestaurantProfileApi` operations.
- [quickstart.md](./quickstart.md) — how to run and manually verify the feature end to end.

## Risks & Gaps Carried Forward

| Item | Impact | Handling |
|---|---|---|
| No submit-for-approval endpoint | Finishing the wizard notifies nobody; an admin must notice the account | Review step is worded to match reality (FR-014). Raised as a backend gap, not hidden. |
| Tax profile unreadable (`PUT` with no `GET`) | Cannot pre-fill or verify the tax step | Spec Decision 2 — standing action, excluded from progress. Retire FR-021 if a `GET` ships. |
| Dismissal cannot be stored server-side | Dismissal is session-scoped, not cross-device | Documented in spec Assumptions and research R4; the checklist card is the durable reminder. |
| `save()` signature change touches three shipped components | Small regression surface in the profile area | Return-value-only change; existing template callers ignore it. Covered by `precheck`. |
| "Complete" is stricter than what the backend requires | UI could call a profile incomplete that the API happily accepted | Confined to wizard progress and the checklist; the profile-area forms keep their existing validation unchanged (R6). |

## Complexity Tracking

No constitution violations — section intentionally empty.
