# Phase 1 Contracts: Onboarding Wizard & Completion Checklist

**Feature**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md) · **Date**: 2026-08-02

This feature exposes no network interface — it adds no endpoint and changes no payload. Its
contracts are internal: the interface the reused forms must satisfy, the completion service's
public surface, and the map from UI action to existing API operation.

---

## 1. `OnboardingStep` — the contract the reused forms satisfy

The wizard drives three components it does not own. Rather than each learning about the wizard,
they satisfy one structural interface the wizard consumes through `viewChild()`.

```ts
// src/app/modules/restaurant/onboarding/onboarding-step.contract.ts

/**
 * What the wizard needs from a step's embedded form. The three profile-area
 * form components already expose `form`; this contract adds only the ability
 * for `save()` to report whether it succeeded.
 */
export interface OnboardingStep {
    /** The step's reactive form, used to gate advancing on validity. */
    readonly form: { invalid: boolean; markAllAsTouched(): void };

    /**
     * Persist this step. Resolves `true` when the write succeeded, `false`
     * when it was rejected or the form was invalid.
     *
     * Implementations keep their existing behaviour of surfacing the failure
     * to the user themselves (snackbar); the boolean exists so the *caller*
     * can decide whether to advance.
     */
    save(): Promise<boolean>;
}
```

### Required change to the three existing components

Each currently declares `async save(): Promise<void>` and swallows the outcome. The change is
the same in all three and is **return-value only** — no parameter, name or side effect changes,
and every existing template caller (`(click)="save()"`) is unaffected.

| Component | File | Change |
|---|---|---|
| `BusinessProfileFormComponent` | [business-profile-form.component.ts](../../../src/app/modules/restaurant/business-profile/business-profile-form.component.ts) | `Promise<void>` → `Promise<boolean>`; `return false` on the invalid-form guard and in `catch`, `return true` after the success toast |
| `TaxProfileFormComponent` | [tax-profile-form.component.ts](../../../src/app/modules/restaurant/tax-profile/tax-profile-form.component.ts) | same |
| `DeliveryAddressesComponent` | [delivery-addresses.component.ts](../../../src/app/modules/restaurant/delivery-addresses/delivery-addresses.component.ts) | same |

**Why the caller and not the component decides**: the components are also used standalone in
`/profile`, where a failed save simply leaves the user on the form. Only the wizard needs to
translate "save failed" into "do not advance" (FR-024), so only the wizard reads the boolean.

### Step-specific notes

- **Business step** — `save()` issues the single `PUT /restaurants/me/profile` carrying both the
  business fields and `businessLicenseUrl`. Advancing must not trigger a second PUT from
  anywhere else (research R2).
- **Tax step** — optional. Its "Continue" advances **without** calling `save()` when the form is
  untouched and empty, so a restaurant that skips tax is not blocked by a pointless write. If
  the restaurant did enter values, `save()` runs and must succeed to advance.
- **Address step** — `DeliveryAddressesComponent` manages its own list-plus-form UI with
  `formOpen`. The wizard's Continue is gated on `addresses().length ≥ 1` rather than on the
  form, since the step's goal is "an address exists", not "the inline form is valid".

---

## 2. `SetupCompletionService` — public surface

```ts
// src/app/modules/restaurant/setup/setup-completion.service.ts

@Injectable({ providedIn: 'root' })
export class SetupCompletionService {
    /** State of each verifiable required item, derived from saved data. */
    readonly states: Signal<Readonly<Record<'business' | 'license' | 'address', SetupItemState>>>;

    /** Counts, outstanding list and the overall flag. See data-model.md § 3. */
    readonly progress: Signal<SetupProgress>;

    /** Ensure the two underlying reads have happened at least once. */
    load(): Promise<void>;

    /** True when this restaurant dismissed the wizard in this browser session. */
    isDismissed(): boolean;

    /** Record a dismissal for the rest of this browser session. */
    dismiss(): void;
}
```

**Contract guarantees**

1. `states` and `progress` are `computed()` over `RestaurantProfileService`'s existing `profile`
   and `deliveryAddresses` signals — never over a private copy. Any write through that service
   is reflected without a reload (FR-018).
2. `progress.total` is always `3`. The tax item never appears in `states`, `outstanding`, or
   either side of the fraction (FR-021).
3. `load()` is idempotent and safe to call from both the wizard and the dashboard card; it
   delegates to the service's existing loaders rather than fetching directly.
4. Nothing in this service writes to the API.

---

## 3. UI action → API operation map

Every operation below already exists and is already called by feature 001's components. This
feature adds **no** new operation and issues no call the profile area does not already make.

| UI action | Operation | Called by |
|---|---|---|
| Load business profile + licence state | `GET /api/v1/restaurants/me/profile` | `RestaurantProfileService.loadProfile()` |
| Save business step (fields **and** licence URL together) | `PUT /api/v1/restaurants/me/profile` | `RestaurantProfileService.saveProfile()` |
| Mint a signed upload for the licence image | `POST /api/v1/restaurants/me/business-license/upload-signature` | `BusinessProfileFormComponent.onLicensePicked()` |
| Save tax step | `PUT /api/v1/restaurants/me/tax-profile` | `RestaurantProfileService.saveTaxProfile()` |
| Load address state | `GET /api/v1/restaurants/me/delivery-addresses` | `RestaurantProfileService.loadDeliveryAddresses()` |
| Add an address in the address step | `POST /api/v1/restaurants/me/delivery-addresses` | `RestaurantProfileService.addDeliveryAddress()` |
| Read approval standing for the review step | `GET /api/v1/restaurants/me/approval-status` | `AuthService` (already populates the user signal) |

| **Submit the account for approval** | **— none exists —** | nothing; the review step posts nothing (FR-014) |

The last row is the contract's most important line. `RestaurantProfileApi` has no
submit-for-review operation, so the review step explains that an administrator will pick the
account up and **must not** present a button implying otherwise.

> **Approval standing values — corrected during implementation.** The spec inherits the wording
> "suspended" from feature 001, but the client's actual type is
> `ApprovalStatus = 'pending' | 'approved' | 'rejected'`
> ([user.types.ts](../../../src/app/core/user/user.types.ts)). There is no `'suspended'` member.
> FR-015 is therefore implemented over those three values: the review step distinguishes
> **pending** ("an administrator will review this"), **approved** ("you can order"), and
> **rejected** ("finishing this setup will not restore ordering — contact support"). The spec's
> "suspended" edge case maps to `'rejected'`.

---

## 4. Routing contract

```ts
// src/app/app.routes.ts — added under the existing storefront area
{
    path: 'onboarding',
    canActivate: [roleGuard(['restaurant'])],
    loadChildren: () => import('app/modules/restaurant/onboarding/onboarding.routes'),
}
```

- `roleGuard(['restaurant'])` already redirects guests to `/sign-in` with a `redirectURL` and
  bounces wrong-role users to `/home`, which is exactly FR-005. No new guard is written.
- The route sits in the storefront area so the wizard renders in the enterprise chrome the rest
  of the restaurant surface uses, and so exiting to `/home` is an in-area navigation.

### Sign-in redirect contract

[sign-in.component.ts](../../../src/app/modules/auth/sign-in/sign-in.component.ts#L111-L119)
currently resolves `redirectURL || permissions.landingUrl()`. The change inserts the onboarding
destination only when the full auto-entry predicate from
[data-model.md § 5](../data-model.md) holds — an explicit `redirectURL` continues to win, so
deep links after sign-in are never hijacked.

---

## 5. Translation contract

New keys go in `public/i18n/en.json` and `public/i18n/vi.json`, both required.

> **Corrected during implementation.** These files use **flat dotted string keys**
> (`"catalog.title": "Product Catalog"`), not nested objects — 1351 of them at the top level,
> appended in feature groups rather than sorted. So the keys below are literal flat keys such as
> `"restaurantOnboarding.steps.business"`, and there is no container object to create first.

| Group | Covers |
|---|---|
| `restaurantOnboarding.title` / `.subtitle` | wizard header |
| `restaurantOnboarding.steps.*` | the four step labels, plus the "optional" marker on tax |
| `restaurantOnboarding.progress` | "step {{current}} of {{total}}" |
| `restaurantOnboarding.actions.*` | continue / back / skip / exit / finish |
| `restaurantOnboarding.review.*` | summary headings, the missing-items list, and the what-happens-next explanation (must not promise a submission) |
| `restaurantOnboarding.checklist.*` | card title, per-item labels, progress wording, the optional tax action |

The embedded forms keep their existing `restaurantProfile.*` keys — no label is re-translated.
