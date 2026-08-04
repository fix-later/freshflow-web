# Phase 0 Research: Restaurant Onboarding Wizard & Completion Checklist

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-08-02

All findings below come from reading the existing codebase and the generated OpenAPI client,
not from assumption. Where the platform cannot support what the spec asks for, that is recorded
as a gap rather than worked around silently.

---

## R1 — Wizard shell: Angular Material stepper

**Decision**: Build the wizard on `MatStepperModule` in a linear-optional configuration, driven
by a signal-held step index, inside a new lazy route.

**Rationale**: Angular Material 22 is already the mandated UI library (constitution § VI) and
`MatStepper` gives step headers, the progress affordance FR-007 requires, and keyboard/ARIA
handling for free. Nothing in the codebase uses a stepper yet (`grep` for `MatStepper` /
`mat-stepper` returns no hits), so this is new surface — but it is new surface inside an
existing dependency, adding no package.

**Alternatives considered**:

- *Hand-rolled step switcher with `@switch`*: fewer Material styles to override, but re-creates
  step headers, completed/edit states and focus management that the stepper already ships.
  Rejected as reinventing a component we already depend on.
- *Route-per-step (`/onboarding/business`, `/onboarding/tax`, …)*: deep-linkable, but each step
  would remount its form and re-fetch, and the "resume at first outstanding step" behaviour
  (FR-012) turns into redirect juggling. Rejected; the wizard keeps one route and holds step
  state in a signal.

---

## R2 — Step composition: the business licence is not a separate save

**Decision**: The wizard has **three data steps plus a review step** — (1) business profile
*including* the licence upload, (2) tax/billing, (3) delivery address, (4) review — while the
completion checklist still tracks the licence as its own **item**, derived from
`businessLicenseUrl`.

**Rationale**: This is the most consequential finding of Phase 0. The business licence is not a
separate resource — `businessLicenseUrl` is a field of `UpdateRestaurantProfileRequest`, and
[business-profile-form.component.ts:98-125](../../src/app/modules/restaurant/business-profile/business-profile-form.component.ts#L98-L125)
uploads the image to Cloudinary and drops the resulting URL into the same form the rest of the
business fields live in. `save()` then PUTs all six fields together.

Splitting the licence into its own wizard step would mean two `PUT /restaurants/me/profile`
calls against one resource. Because the existing `save()` sends every field from its own form
state, the second PUT would overwrite the first step's values with whatever that second
component held — a real clobbering bug, not a theoretical one.

Keeping them in one step preserves the single-PUT invariant. FR-006 asks for steps "covering"
the four items, which one step covering two items satisfies; FR-022's three required *items*
remain independently tracked because each is derived separately from saved data (R6).

**Alternatives considered**:

- *Separate licence step issuing its own PUT*: rejected — clobbers, per above.
- *Separate licence step that defers its PUT until the business step's save*: rejected — makes
  step 1's "saved" state depend on a later step, contradicting FR-009's promise that advancing
  past a step persists it.
- *Refactor the backend contract to give the licence its own endpoint*: out of scope; the
  backend is fixed and this feature adds no endpoints.

---

## R3 — Reusing the existing forms: a minimal `save()` contract

**Decision**: Embed the three existing section components unchanged in structure, and add one
small change to each — `save()` returns `Promise<boolean>` instead of `Promise<void>`. The
wizard holds each child via `viewChild()`, and its "Continue" button calls `child.save()` and
only advances when it resolves `true`.

**Rationale**: All three components already expose exactly what a wizard needs — a public
`form` and a public `save()`:

| Component | Public surface today |
|---|---|
| [BusinessProfileFormComponent](../../src/app/modules/restaurant/business-profile/business-profile-form.component.ts) | `form`, `save()`, `saving`, `loading` |
| [TaxProfileFormComponent](../../src/app/modules/restaurant/tax-profile/tax-profile-form.component.ts) | `form`, `save()`, `saving` |
| [DeliveryAddressesComponent](../../src/app/modules/restaurant/delivery-addresses/delivery-addresses.component.ts) | `form`, `save()`, `addresses`, `formOpen` |

The one thing missing is a success signal. Each `save()` currently catches its own error, shows
a snackbar and returns `void`, so a caller cannot distinguish a saved step from a rejected one.
FR-024 requires the step to stay outstanding when a save is rejected, so the wizard must know.
Returning a boolean is a three-line change per component and breaks no existing caller —
templates invoke `(click)="save()"` and discard the result.

**Alternatives considered**:

- *Duplicate the forms inside the wizard*: rejected outright — FR-025 forbids introducing new
  data, spec § Assumptions says the forms already exist, and three duplicated reactive forms
  would drift from the originals within a release.
- *Extract each form into a shared presentational child plus two container wrappers*: the
  textbook decomposition, but it rewrites three working, tested components to serve one new
  caller. Rejected as disproportionate; revisit if a third consumer appears.
- *Emit an `@Output() saved` event instead of returning a boolean*: equivalent in effect, but
  the wizard's Continue handler is already `async`, so awaiting a returned boolean reads
  straightforwardly where subscribing to an output would need a promise bridge.

---

## R4 — "Dismissed" cannot be stored per restaurant (gap)

**Decision**: Persist the dismissal in `sessionStorage`, keyed by the restaurant's user id, so
it lasts the browser session. Auto-entry therefore happens **at most once per session** and
stops permanently once the required setup is complete.

**Rationale**: The spec's Assumptions say the dismissal choice should be "per restaurant, not
per device". Phase 0 found that is not currently achievable. `RestaurantProfileApi` exposes
exactly six operations —

```text
GET    /api/v1/restaurants/me/approval-status
GET    /api/v1/restaurants/me/profile
PUT    /api/v1/restaurants/me/profile
PUT    /api/v1/restaurants/me/tax-profile
GET    /api/v1/restaurants/me/delivery-addresses
POST   /api/v1/restaurants/me/delivery-addresses
PUT    /api/v1/restaurants/me/delivery-addresses/{id}
DELETE /api/v1/restaurants/me/delivery-addresses/{id}
POST   /api/v1/restaurants/me/business-license/upload-signature
```

— and none of them carries a per-restaurant UI preference. Storing "dismissed" server-side
would require a new endpoint, which is out of scope.

Session scope is chosen over `localStorage` deliberately: a restaurant that dismisses the
wizard should still be reminded next time it signs in, because the account genuinely is not
reviewable yet. Permanent local dismissal would let an incomplete restaurant silence the one
prompt that gets it approved, and the checklist card (US3) is the gentler standing reminder
that survives regardless.

**Consequence — spec amended**: the Assumptions entry claiming per-restaurant dismissal has
been corrected to describe session scope and to name the backend support that would be needed
to do better. The spec should not promise behaviour the platform cannot deliver.

**Alternatives considered**:

- *`localStorage` (permanent, per device)*: silences the prompt forever on that browser while
  still nagging on another — the worst of both scopes.
- *No dismissal at all, redirect on every navigation until complete*: traps a pending
  restaurant, violating FR-003 and BR-AUTH-1's browse right.

---

## R5 — Auto-entry happens at sign-in, not in a route guard

**Decision**: Decide the redirect into `/onboarding` in
[sign-in.component.ts](../../src/app/modules/auth/sign-in/sign-in.component.ts#L111-L119),
where the per-role landing page is already resolved. Guard `/onboarding` itself with
`roleGuard(['restaurant'])` for FR-005 only.

**Rationale**: [app.routes.ts:22-24](../../src/app/app.routes.ts#L22-L24) documents the
existing convention explicitly — per-role landing is decided in the auth components, because
that is the point at which the profile, and therefore the role, has loaded. Sign-in already
calls `this._permissions.landingUrl()` and honours an explicit `redirectURL` query param. The
onboarding redirect belongs in the same place: an incomplete restaurant with no explicit
`redirectURL` lands on `/onboarding` instead of `/home`.

A `canActivate` guard on the storefront area was considered and rejected: it would run on every
storefront navigation, would have to load profile and address data before it could decide, and
would fight the user's attempt to browse — precisely the trap FR-003 forbids.

**Note**: an explicit `redirectURL` always wins, so a deep link into the app after sign-in is
never hijacked by onboarding.

---

## R6 — Completion is derived from saved data, never remembered

**Decision**: Compute each required item's state from data the platform can read back:

| Item | Derived from | Rule |
|---|---|---|
| Business profile | `GET /restaurants/me/profile` | `name` present **and** `address` present **and** `contactPerson` present **and** both `pickupStart`/`pickupEnd` present |
| Business licence | `GET /restaurants/me/profile` | `businessLicenseUrl` is non-null |
| Delivery address | `GET /restaurants/me/delivery-addresses` | at least one saved address |
| Tax / billing | *not readable* | no state — standing action only (spec Decision 2) |

**Rationale**: FR-020 requires derivation from saved data rather than from a record of visited
screens, and FR-018 requires the checklist to regress when data is removed — both of which fall
out of computing state from the two GETs rather than tracking progress separately. Both reads
already exist on `RestaurantProfileService` and populate signals (`profile`,
`deliveryAddresses`), so the checklist is a `computed()` over state the profile area already
loads, not a new fetch path.

The business-profile rule deserves note: the backend marks every field optional
(`address?`, `contactPerson?`, `pickupStart?`, `pickupEnd?` are all nullable in
`UpdateRestaurantProfileRequest`), and the existing form only requires `name`. "Complete" for
onboarding purposes is therefore a **UI-side notion** layered on top — it does not and must not
change what the form accepts when edited normally from the profile area. Only the wizard's
progress and the checklist card apply the stricter reading.

---

## R7 — Translations extend the existing flat i18n files

**Decision**: Add keys under a new `restaurantOnboarding` top-level object in
`public/i18n/en.json` and `public/i18n/vi.json`. Reuse existing `restaurantProfile.*` keys for
the embedded forms rather than re-translating their labels.

**Rationale**: Transloco loads flat per-language JSON from `public/i18n/`; `en.json` and
`vi.json` are the maintained pair (`tr.json` is a 90-byte stub, not a supported language).
Because the wizard embeds the existing form components unchanged, their labels and errors are
already translated — the new keys cover only wizard chrome: step titles, progress wording, the
review step's explanation of admin approval, the checklist card, and the optional-step label.

---

## Open items carried into the plan

- **No submit-for-approval endpoint** (spec § Assumptions, confirmed in R4's operation list).
  The review step explains that an administrator reviews the account; it posts nothing. This is
  a product-level gap worth raising with the backend, not something the UI can paper over.
- **No readable tax profile.** Settled for this feature by spec Decision 2, but if
  `GET /restaurants/me/tax-profile` ever ships, R6's table gains a fourth row and FR-021 is
  retired.
