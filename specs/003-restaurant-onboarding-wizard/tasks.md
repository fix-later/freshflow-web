---

description: "Task list for Restaurant Onboarding Wizard & Completion Checklist"
---

# Tasks: Restaurant Onboarding Wizard & Completion Checklist

**Input**: Design documents from `specs/003-restaurant-onboarding-wizard/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/onboarding-ui-contract.md)

**Tests**: Included. Not optional here — constitution § IV ("Test Before Merge") makes unit
tests a merge gate, and [plan.md](./plan.md) § Technical Context names the three behaviours
worth covering: the completion-derivation rules, the session-scoped dismissal, and the
step-advance-blocks-on-failed-save rule. Tests are scoped to those; the rest is UI wiring that
`precheck`'s production build and the [quickstart](./quickstart.md) walkthrough cover better
than a unit test would.

**Organization**: Tasks are grouped by user story so each can be implemented, tested and
shipped on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task serves (US1, US2, US3)
- Every task names its exact file path

## Path Conventions

Single Angular frontend. All source paths are relative to the repository root and follow
[plan.md](./plan.md) § Project Structure:

- New wizard: `src/app/modules/restaurant/onboarding/`
- New shared completion logic: `src/app/modules/restaurant/setup/`
- Translations: `public/i18n/en.json`, `public/i18n/vi.json`

## ⚠️ Carry this constraint through every phase

`businessLicenseUrl` is a **field of the business-profile form**, not a separate resource. The
business step must issue exactly **one** `PUT /restaurants/me/profile` carrying both the
business fields and the licence URL. A second PUT from a separate licence step overwrites the
first step's values — see [research.md](./research.md) R2. This is the regression most likely
to be introduced by "helpfully" splitting the step.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the two feature folders and the translation scope everything else fills in.

This phase is deliberately thin — the project, tooling, linting and i18n plumbing all already
exist, so there is nothing to initialise.

- [X] T001 Create the feature directories `src/app/modules/restaurant/onboarding/` and `src/app/modules/restaurant/setup/`
- [X] T002 Add an empty top-level `restaurantOnboarding` scope object to `public/i18n/en.json` and `public/i18n/vi.json`, placed alphabetically among the existing scopes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The completion-derivation spine. All three user stories read from it — US1's review
step names outstanding items, US2 resumes at the first outstanding step, US3 renders the card —
so none can start until it exists.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Define `SetupItemId`, `SetupItemState` and `SetupProgress` in `src/app/modules/restaurant/setup/setup.types.ts` per [data-model.md](./data-model.md) §§ 1, 3 — keep `SetupItemState` a two-member union so the unverifiable tax item cannot be given a state
- [X] T004 Implement `SetupCompletionService` in `src/app/modules/restaurant/setup/setup-completion.service.ts`: `states` and `progress` as `computed()` over the existing `RestaurantProfileService.profile` and `.deliveryAddresses` signals, plus an idempotent `load()` that delegates to that service's existing loaders — see [contracts](./contracts/onboarding-ui-contract.md) § 2
- [X] T005 Implement the derivation rules from [data-model.md](./data-model.md) § 2 inside `src/app/modules/restaurant/setup/setup-completion.service.ts`: `business` requires name + address + contactPerson + both pickup times non-empty (whitespace counts as empty); `license` requires a non-empty `businessLicenseUrl`; `address` requires at least one saved address; `tax` gets no state and `progress.total` is fixed at 3
- [X] T006 Add session-scoped `isDismissed()` / `dismiss()` to `src/app/modules/restaurant/setup/setup-completion.service.ts`, keyed `ffx.onboarding.dismissed.<userId>` in `sessionStorage` per [data-model.md](./data-model.md) § 5
- [X] T007 Write unit tests in `src/app/modules/restaurant/setup/setup-completion.service.spec.ts` covering every derivation rule from T005 — including the whitespace-only case, the licence-present-but-profile-incomplete case, the "one address with no default still counts" case, and the invariant that `progress.total` stays 3 whether or not tax was ever saved
- [X] T008 Extend `src/app/modules/restaurant/setup/setup-completion.service.spec.ts` with dismissal tests: `dismiss()` then `isDismissed()` is true; a different user id is unaffected; the value lives in `sessionStorage` and not `localStorage`

**Checkpoint**: Completion state is derivable and tested — user stories can begin.

---

## Phase 3: User Story 1 - Complete the required setup in one guided pass (Priority: P1) 🎯 MVP

**Goal**: A newly verified restaurant signing in is taken into a four-step wizard, fills in the
business profile (with licence), tax and delivery address, and reaches a review step that
summarises what was provided and explains that an administrator now reviews the account.

**Independent Test**: Register a restaurant, verify the email, sign in, and complete the wizard
end to end without visiting `/profile` — then confirm from `/profile` that every value saved,
and that the review step's summary matched what actually saved.

### Tests for User Story 1

- [X] T009 [P] [US1] Write unit tests in `src/app/modules/restaurant/onboarding/onboarding.component.spec.ts` asserting that Continue does **not** advance the step index when the embedded step's `save()` resolves `false`, and does advance when it resolves `true` (FR-024, FR-009)
- [X] T010 [P] [US1] Add a test to `src/app/modules/restaurant/onboarding/onboarding.component.spec.ts` asserting the tax step advances **without** calling `save()` when its form is untouched and empty (spec Decision 2)

### Implementation for User Story 1

- [X] T011 [P] [US1] Declare the `OnboardingStep` interface in `src/app/modules/restaurant/onboarding/onboarding-step.contract.ts` per [contracts](./contracts/onboarding-ui-contract.md) § 1
- [X] T012 [P] [US1] Widen `save()` to `Promise<boolean>` in `src/app/modules/restaurant/business-profile/business-profile-form.component.ts` — `return false` from the invalid-form guard and the `catch`, `return true` after the success toast; leave all other behaviour, including the snackbar, unchanged
- [X] T013 [P] [US1] Widen `save()` to `Promise<boolean>` in `src/app/modules/restaurant/tax-profile/tax-profile-form.component.ts`, same shape as T012
- [X] T014 [P] [US1] Widen `save()` to `Promise<boolean>` in `src/app/modules/restaurant/delivery-addresses/delivery-addresses.component.ts`, same shape as T012
- [X] T015 [US1] Build the wizard shell in `src/app/modules/restaurant/onboarding/onboarding.component.ts` and `.html`: `MatStepper`, a signal-held step index, the "step N of 4" progress indicator (FR-007), and `viewChild()` handles on the three embedded step components (depends on T011)
- [X] T016 [US1] Wire step 1 in `src/app/modules/restaurant/onboarding/onboarding.component.html` to embed `BusinessProfileFormComponent` **including its licence uploader**, so the step persists business fields and licence in a single PUT (depends on T012, T015) — see the constraint at the top of this file
- [X] T017 [US1] Wire step 2 (tax, labelled optional) and step 3 (delivery address) in `src/app/modules/restaurant/onboarding/onboarding.component.html`, gating step 3's Continue on `addresses().length >= 1` rather than on form validity (depends on T013, T014, T015)
- [X] T018 [US1] Implement the save-gated Continue handler in `src/app/modules/restaurant/onboarding/onboarding.component.ts`: call the active step's `save()`, advance only on `true`, and keep the step outstanding with its values intact on `false` (FR-008, FR-009, FR-024) — makes T009 and T010 pass
- [X] T019 [US1] Build the review step in `src/app/modules/restaurant/onboarding/review-step.component.ts` and `.html`: summarise what was provided, name each outstanding item from `SetupCompletionService.progress` with a link that opens it, and state that an administrator reviews the account and ordering stays unavailable until approved (FR-013, FR-014) — **no submit button; no endpoint exists** (depends on T004)
- [X] T020 [US1] Make the review step's wording reflect the real approval standing — pending, approved or suspended — from the user signal rather than assuming pending, in `src/app/modules/restaurant/onboarding/review-step.component.ts` (FR-015)
- [X] T021 [US1] Create the lazy route in `src/app/modules/restaurant/onboarding/onboarding.routes.ts` and register `path: 'onboarding'` with `canActivate: [roleGuard(['restaurant'])]` under the storefront area in `src/app/app.routes.ts` (FR-005) — see [contracts](./contracts/onboarding-ui-contract.md) § 4
- [X] T022 [US1] Add the auto-entry redirect in `src/app/modules/auth/sign-in/sign-in.component.ts`: route an incomplete restaurant to `/onboarding` using the full predicate in [data-model.md](./data-model.md) § 5, keeping an explicit `redirectURL` query param the winner (FR-002, research R5)
- [X] T023 [US1] Add the wizard, step-label, progress and review translation keys to `public/i18n/en.json` and `public/i18n/vi.json` under `restaurantOnboarding` per [contracts](./contracts/onboarding-ui-contract.md) § 5 — the review copy must not promise a submission (FR-014, FR-023)

**Checkpoint**: A restaurant can be guided from sign-in through to a truthful review step. This
is the MVP — it already converts registrations into reviewable accounts.

---

## Phase 4: User Story 2 - Leave the setup and resume it later (Priority: P2)

**Goal**: The restaurant can skip a step, exit the wizard entirely and browse, and come back —
on any device — to find saved answers intact and outstanding steps still outstanding.

**Independent Test**: Start the wizard, complete one step, skip the next, exit, sign out, sign
in on a different browser, re-open the wizard, and confirm the completed step shows its saved
values while the skipped step is still outstanding.

### Tests for User Story 2

- [X] T024 [P] [US2] Write unit tests in `src/app/modules/restaurant/onboarding/onboarding.component.spec.ts` for the resume rule: the initial step index is the first step whose required items are not all `done`, and the review step when everything required is done (FR-012)

### Implementation for User Story 2

- [X] T025 [US2] Add a Skip action to each non-final step in `src/app/modules/restaurant/onboarding/onboarding.component.ts` and `.html` that advances without saving and leaves the step outstanding (FR-010)
- [X] T026 [US2] Add an Exit action in `src/app/modules/restaurant/onboarding/onboarding.component.ts` and `.html` that calls `SetupCompletionService.dismiss()` and navigates to `/home`, so the restaurant can browse as BR-AUTH-1 entitles it to (FR-003, FR-004; depends on T006)
- [X] T027 [US2] Implement the resume rule in `src/app/modules/restaurant/onboarding/onboarding.component.ts`: compute the initial step index from `SetupCompletionService.progress` on entry (FR-012; depends on T004) — makes T024 pass
- [X] T028 [US2] Ensure returning to an earlier step shows its saved values by loading server state on wizard entry via `SetupCompletionService.load()` in `src/app/modules/restaurant/onboarding/onboarding.component.ts` (FR-011, FR-003 cross-device resume) — note the tax step cannot pre-fill, which is expected and documented in spec Decision 2
- [X] T029 [US2] Add skip/exit/back translation keys to `public/i18n/en.json` and `public/i18n/vi.json` under `restaurantOnboarding.actions` (FR-023)

**Checkpoint**: The wizard survives real use — a restaurant missing one document no longer
abandons it.

---

## Phase 5: User Story 3 - See what is outstanding from the profile area (Priority: P3)

**Goal**: A getting-started card on the `/profile` overview lists the three required items with
their states and overall progress, deep-links each outstanding one to the matching section, and
recedes once nothing verifiable is outstanding.

**Independent Test**: With a partly complete restaurant, open the profile overview, confirm the
card names exactly the outstanding items, follow one link, complete that item, return, and
confirm the card advanced by one without a reload.

### Implementation for User Story 3

- [X] T030 [P] [US3] Build the card in `src/app/modules/restaurant/setup/setup-checklist.component.ts` and `.html`: the three required items with done/outstanding state and progress out of 3, reading `SetupCompletionService.progress` (FR-016, FR-022; depends on T004)
- [X] T031 [US3] Render the tax item in `src/app/modules/restaurant/setup/setup-checklist.component.html` as a standing action — never a tick, never counted, never reported as outstanding (FR-021, spec Decision 2)
- [X] T032 [US3] Deep-link each outstanding item in `src/app/modules/restaurant/setup/setup-checklist.component.html` to its profile section via the existing query-param convention — `/profile?section=business`, `?section=addresses`, `?section=tax` (FR-017)
- [X] T033 [US3] Host the card in `src/app/modules/restaurant/dashboard/restaurant-dashboard.component.ts` and `.html`, above the credit figures, and hide it when `progress.isComplete` or the account is already approved (FR-019, edge case "already approved")
- [X] T034 [US3] Verify the card updates without a reload and regresses when data is removed — it should fall out of the `computed()` chain from T004 with no extra code; if it does not, fix the derivation rather than adding a manual refresh (FR-018)
- [X] T035 [US3] Add checklist translation keys to `public/i18n/en.json` and `public/i18n/vi.json` under `restaurantOnboarding.checklist`, including the optional tax action label (FR-023)

**Checkpoint**: All three stories are independently functional. Restaurants that registered
before this feature are now recoverable too.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T036 [P] Check the wizard at phone width in `src/app/modules/restaurant/onboarding/onboarding.component.html` — a restaurant owner photographing a licence is plausibly on a phone
- [X] T037 [P] Sweep `public/i18n/en.json` and `public/i18n/vi.json` for any key added by this feature that exists in one file but not the other (FR-023, SC-007)
- [X] T038 Confirm the `/onboarding` chunk is lazy and absent from the initial bundle by inspecting `npm run build -- --configuration production` output (constitution § VI)
- [ ] T039 Confirm no new endpoint is called: compare the network tab against [contracts](./contracts/onboarding-ui-contract.md) § 3 — every request must be one the profile area already makes
- [ ] T040 Walk all 27 manual checks in [quickstart.md](./quickstart.md)
- [ ] T041 Run `npm run precheck` and fix anything it reports — this is the merge gate; do not bypass the hooks

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: needs Phase 1 — **blocks all three user stories**
- **US1 (Phase 3)**: needs Phase 2
- **US2 (Phase 4)**: needs Phase 2. Touches the same wizard component as US1, so in practice it
  follows US1 rather than running beside it
- **US3 (Phase 5)**: needs Phase 2 only — genuinely independent of US1 and US2, and could be
  built first or in parallel by a second developer
- **Polish (Phase 6)**: needs whichever stories are being shipped

### Within each story

- Tests before the implementation they cover (T009/T010 before T018; T024 before T027)
- The contract (T011) before the shell that consumes it (T015)
- The `save()` widening (T012–T014) before the steps that embed those components (T016, T017)
- The shell (T015) before step wiring (T016–T018)
- Translations last within a story, once the keys the templates need are known

### Parallel Opportunities

- **T012, T013, T014** — three different component files, no shared state. The clearest
  parallel win in the feature
- **T009, T010** — both spec-file tasks, written before implementation
- **T030** can proceed while US1/US2 are in flight; it shares only the Phase 2 service
- **T036, T037** — different concerns, different files

### Not parallel, despite appearances

- **T002, T023, T029, T035** all write `public/i18n/en.json` and `vi.json`. Sequence them or
  expect merge conflicts
- **T015–T018, T025–T028** all write `onboarding.component.ts`. One developer, one at a time

---

## Parallel Example: User Story 1

```bash
# The three save() widenings — different files, identical shape:
Task: "Widen save() to Promise<boolean> in business-profile-form.component.ts"
Task: "Widen save() to Promise<boolean> in tax-profile-form.component.ts"
Task: "Widen save() to Promise<boolean> in delivery-addresses.component.ts"

# Both wizard tests, written before T018 implements the behaviour:
Task: "Continue does not advance when save() resolves false"
Task: "Tax step advances without calling save() when untouched"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 → Phase 2 → Phase 3
2. **Stop and validate**: run quickstart checks A (auto-entry/escape), B (steps/saving) and C
   (review step)
3. At this point registrations already become reviewable accounts — the problem the feature
   exists to solve is solved, even without resume or the checklist card

### Incremental delivery

1. Setup + Foundational → derivation exists and is tested
2. **+ US1** → guided pass works → demo (MVP)
3. **+ US2** → survives interruption → demo
4. **+ US3** → recoverable long after signup, and covers pre-existing restaurants → demo

### Parallel team strategy

Two developers after Phase 2: one takes US1 then US2 (both own `onboarding.component.ts`), the
other takes US3 (own files, shares only the service). Sequence the i18n edits between them.

---

## Status — 2026-08-02

**37 of 41 done.** All three user stories are implemented; what remains needs a running app.

Verified by automated gates:

| Gate | Result |
|---|---|
| `ng lint` | All files pass |
| Unit tests | **147/147 pass**, including 52 new (32 derivation/dismissal, 20 wizard) |
| Contrast check | 51 palette pairs ≥ 4.5:1 |
| Production build | Clean. Initial total **1.70 MB** (budget: 3 MB warn / 5 MB error) |
| Lazy chunk (T038) | `onboarding-routes` 46.64 kB raw / 10.76 kB transferred — off the initial bundle |
| i18n parity (T037) | 0 keys present in one language file but not the other |

Still open:

- **T036, T039, T040** — need the app running against a backend: phone-width check, the
  network-tab comparison, and the 27-step [quickstart](./quickstart.md) walkthrough. The
  behaviour each would check is unit-tested where a unit test can reach it, but none of it has
  been seen in a browser.
- **T041** — `npm run precheck` currently fails at the Prettier stage on
  `src/app/layout/common/storefront-header/storefront-top-strip.component.html`. That file is
  **unchanged from HEAD** and untouched by this feature — a pre-existing formatting violation,
  left alone rather than swept into this diff. Every other precheck stage passes. One
  `prettier --write` on that file clears the gate.

### Corrections made during implementation

Two design-doc assumptions proved wrong against the real codebase and were fixed in the docs
rather than worked around in code:

1. **i18n files use flat dotted keys**, not nested objects — 1351 top-level string keys. The
   contract's § 5 was corrected; T002's "empty scope object" had nothing to create, so the keys
   went in with T023 and T035.
2. **`ApprovalStatus` is `pending | approved | rejected`** — there is no `suspended` member
   despite the spec's wording (inherited from feature 001). FR-015 is implemented over the three
   real values, with `rejected` getting copy that does not promise ordering will return.

## Notes

- **41 tasks**: 2 setup, 6 foundational, 15 US1, 6 US2, 6 US3, 6 polish
- The single most important invariant: **one PUT for the business step**
  ([research.md](./research.md) R2)
- The review step must never grow a submit button — no endpoint backs it
  ([contracts](./contracts/onboarding-ui-contract.md) § 3)
- Progress is always out of 3; the tax item never counts
  ([data-model.md](./data-model.md) § 3)
- Commit after each task or logical group; `precheck` runs on push
