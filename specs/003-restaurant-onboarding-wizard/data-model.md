# Phase 1 Data Model: Restaurant Onboarding Wizard & Completion Checklist

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-08-02

This feature stores nothing new. Every value it shows is either already persisted behind
`/api/v1/restaurants/me/*` or computed from those values. The "model" here is therefore a
**derivation model**: how the four setup items get their state, and how progress falls out of
them.

---

## 1. Setup items

Four items, three of which gate review (spec Decision 1).

| Id | Required? | Verifiable? | Where it is edited |
|---|---|---|---|
| `business` | ✅ required | ✅ yes | Business profile form |
| `license` | ✅ required | ✅ yes | Business profile form (same form, licence field) |
| `address` | ✅ required | ✅ yes | Delivery addresses |
| `tax` | ❌ optional | ❌ **no** | Tax profile form |

```ts
/** The four things a restaurant supplies during setup. */
export type SetupItemId = 'business' | 'license' | 'address' | 'tax';

/**
 * A verifiable item's state. `tax` has no state at all — it is unreadable
 * (spec Decision 2), so it is deliberately absent from this union rather
 * than given an 'unknown' member that callers would have to render.
 */
export type SetupItemState = 'done' | 'outstanding';
```

> **Why `tax` has no state.** Giving it an `'unknown'` state would push a third case into every
> template and invite someone to render it as a half-checked box — which is exactly the
> misleading affordance FR-021 forbids. Keeping the union at two members makes the honest
> behaviour the only expressible one: the tax item is rendered by a separate branch as a plain
> action, never as a checklist row with a state.

---

## 2. Derivation rules

All three verifiable items derive from two reads that `RestaurantProfileService` already
performs and caches in signals — `profile` and `deliveryAddresses`. No new fetch path.

### `business` — the business profile is filled in

```text
done  ⟺  name          is non-empty
     ∧   address       is non-empty
     ∧   contactPerson is non-empty
     ∧   pickupStart   is non-empty
     ∧   pickupEnd     is non-empty
```

Source: `GET /api/v1/restaurants/me/profile` → `RestaurantProfileView`.

Note the asymmetry with the form's own validation, which requires only `name`. This stricter
reading is a **UI-side notion of "ready for review"** and must not be pushed into the form's
validators — editing the profile normally from `/profile` stays as permissive as the backend is
(research R6).

Whitespace-only strings count as empty, matching the `emptyToNull` convention the existing forms
already apply before sending.

### `license` — a business licence image is attached

```text
done  ⟺  businessLicenseUrl is non-empty
```

Source: the same `GET /api/v1/restaurants/me/profile` response. It is a separate *item* despite
sharing a *step* and an *endpoint* with `business` (research R2).

### `address` — at least one delivery address exists

```text
done  ⟺  deliveryAddresses.length ≥ 1
```

Source: `GET /api/v1/restaurants/me/delivery-addresses`.

Spec FR-022 requires only that an address exists — not that one is marked default. The existing
`defaultDeliveryAddress()` helper already falls back to the first address when none is flagged,
so an unflagged single address is usable and should not be reported as outstanding work.

### `tax` — not derivable

No `GET /api/v1/restaurants/me/tax-profile` exists. There is no rule, by design.

---

## 3. Progress

```ts
export interface SetupProgress {
    /** Verifiable required items that are done. 0–3. */
    readonly completed: number;
    /** Always 3 — business, license, address (spec Decision 1). */
    readonly total: number;
    /** Required items still outstanding, in wizard order. */
    readonly outstanding: readonly SetupItemId[];
    /** True when every required item is done. */
    readonly isComplete: boolean;
}
```

`total` is fixed at 3. The tax item never contributes to either side of the fraction, so
"3 of 3" is honestly reachable by a restaurant that skipped tax — which is the whole point of
spec Decision 2.

**Reactivity**: `SetupProgress` is a `computed()` over the `RestaurantProfileService` signals.
Because the profile-area forms write through that same service, completing an item anywhere
updates the checklist card without a reload, satisfying FR-018 — and deleting the last address
flips `address` back to `outstanding` by the same mechanism, satisfying the "progress regresses"
edge case with no extra code.

---

## 4. Wizard step model

Four steps. Note that steps and items are **not** one-to-one — step 1 covers two items.

| # | Step | Items covered | Embedded component | Persists via |
|---|---|---|---|---|
| 1 | Business profile | `business`, `license` | `BusinessProfileFormComponent` | `PUT /restaurants/me/profile` (one call, all fields) |
| 2 | Tax & billing *(optional)* | `tax` | `TaxProfileFormComponent` | `PUT /restaurants/me/tax-profile` |
| 3 | Delivery address | `address` | `DeliveryAddressesComponent` | `POST /restaurants/me/delivery-addresses` |
| 4 | Review | — | `ReviewStepComponent` | nothing — posts no submission (FR-014) |

```ts
/** Transient wizard state — signals in the shell component, persisted nowhere. */
interface WizardState {
    readonly stepIndex: number;      // resumes at the first outstanding step (FR-012)
    readonly advancing: boolean;     // a step's save is in flight
}
```

**Resume rule (FR-012)**: on entry, the initial `stepIndex` is the index of the first step whose
covered required items are not all `done`; if every required item is done, the wizard opens on
the review step.

---

## 5. Session-scoped dismissal

The one piece of client-only state, and the only thing this feature writes outside the API.

```text
key    sessionStorage['ffx.onboarding.dismissed.' + userId]
value  '1'  (presence is the signal; absence means not dismissed)
scope  browser session — cleared when the tab/session ends
```

Keyed by user id so that signing out and in as a different restaurant on a shared machine does
not inherit the previous account's dismissal. It cannot live on the server: no endpoint accepts
a per-restaurant UI preference (research R4).

**Auto-entry predicate**, evaluated once at sign-in:

```text
redirect to /onboarding  ⟺  role is 'restaurant'
                         ∧  no explicit redirectURL query param
                         ∧  approval status is not 'approved'
                         ∧  progress.isComplete is false
                         ∧  not dismissed this session
```

Each conjunct maps to a requirement: role → FR-005; explicit `redirectURL` → deep links are
never hijacked (research R5); approved → FR-002's carve-out; complete → FR-004; dismissed →
FR-004.

---

## 6. Entities this feature reads but never writes

| Entity | Source | Use |
|---|---|---|
| `RestaurantProfileView` | `GET /restaurants/me/profile` | derive `business` and `license` |
| `DeliveryAddressView[]` | `GET /restaurants/me/delivery-addresses` | derive `address` |
| Approval standing | `AuthService` → user signal (`approvalStatus`) | the review step's wording, and the auto-entry predicate |

Approval standing is read-only here in the strongest sense: this feature displays and explains
it, and has no mechanism to change it. That is the server's and the administrator's alone
(BR-AUTH-1, BR-AUTH-4).
