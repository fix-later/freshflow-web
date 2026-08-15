# Remaining slices

Costed from what slice 1 actually took, not from a guess: **20 scenarios / 25 runs / 104s** of
machine time, against a surface of ~65 implemented screens (14 storefront, 11 restaurant
account, ~35 admin console, 7 auth).

Machine time is not the constraint — the whole remaining plan runs in well under ten minutes.
The cost is authoring fixtures for each new module's endpoints, and reviewing screenshots. Slice
1 spent most of its effort mapping the M5 endpoints and their field spellings; that mapping cost
recurs once per module, then never again.

## Five more slices, ~106 scenarios

| #     | Modules                          | Screens                                                                                                                                                                                                                                              | Scenarios | The states that make it worth running                                                                                                                                                                                                                                                                                                                        |
| ----- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **2** | M6 Credit, M2 Profile            | `/profile/credit`, `/profile/invoices`, `/profile/claims`, `/profile/business`, `/profile/tax`, `/profile/addresses`, `/profile/account`, `/profile/dashboard`, `/onboarding`, `/invoices`                                                           | ~22       | balance under / near / over limit (BR-CRE-2), statement + recorded payment (BR-CRE-3), discrepancy adjustment (BR-CRE-4), no statements yet, claim per status, onboarding step exit with unsaved work, incomplete profile checklist, all of it × pending/approved/suspended                                                                                  |
| **3** | M3 Catalog, M4 Pricing           | `/home`, `/catalog`, `/catalog/:productId`, `/wishlist`, market picker, search overlay                                                                                                                                                               | ~20       | OUT_OF_STOCK stays visible (BR-PRI-1), live price broadcast + highlight without reflow (BR-PRI-3), **disconnected → "reconnecting…" → re-fetch not replay**, no market selected, empty search, page 2 of infinite scroll, guest vs restaurant, price-alert threshold as `R⁺` (BR-PRI-4)                                                                      |
| **4** | M3/M4/M13 admin                  | `/admin`, `/admin/restaurants` (+detail, approve / suspend / credit limit), `/admin/products` (+new), `/admin/categories`, `/admin/units`, `/admin/markets` (+products, price-history), `/admin/users` (+new), `/admin/tags`, `/admin/packing-codes` | ~24       | approve / reject / suspend a restaurant (BR-AUTH-1, BR-ADM-1), credit-limit edit, price > 0 and quantity ≥ 0 rejected at the field (BR-PRI-1), deactivation is a soft delete that keeps history (BR-CAT-1), immutable price snapshots (BR-PRI-2), **`operations_manager` vs `admin` column of ROLE_MATRIX** — the role exists in code with no account issued |
| **5** | M7–M10 ops                       | `/admin/order-groups` (+detail), `/admin/order-group-settings`, `/admin/hubs` (+detail), `/admin/routes` (+new, +detail), `/admin/vehicles`, `/admin/orders` (+detail), `/admin/scheduled-orders` (+detail)                                          | ~22       | batching before / after cutoff (BR-PROC-1), an order in at most one active batch (BR-PROC-2), **open discrepancy blocks dispatch** (BR-HUB-2), manifest mismatch flagged (BR-HUB-1), route over the stop limit / no available driver (BR-LOG-2/3), delivery `FAILED` with proof (BR-DEL-1)                                                                   |
| **6** | M1 auth screens, M11–M12, errors | `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/confirmation-required`, `/unlock-session`, `/admin/audit-logs`, `/admin/finance`, `/admin/invoices` (+detail), `/admin/claims`, analytics, `/404`, `/500`, notification panel       | ~18       | lockout after repeated failures (BR-AUTH-3), expiry → silent refresh vs bounce to sign-in (BR-AUTH-5), self-registration lands `PENDING_APPROVAL` (BR-AUTH-1), CSV export only (BR-ANA-1), notification retry + history, in-app/push only — no SMS/email (BR-NOT-1), audit log read-only (BR-ADM-2)                                                          |

## Recommended order, and why

1. **Slice 2 (credit).** It is the other half of the post-paid model that slice 1 only touched
   from the buying side, and PRD RC-1 makes it the thing that most distinguishes this product.
   Highest remaining business risk.
2. **Slice 4 (admin restaurants + pricing).** Closes the loop end to end: slice 1 found that the
   approval gate is half-wired on the restaurant side; slice 4 audits the side that grants it,
   plus the credit limit that slice 2 will have audited from below.
3. **Slice 3 (catalog + pricing).** Schedule the SignalR fake with it — see below.
4. **Slice 5 (ops).** Largest screen count, but the least user-facing per screen.
5. **Slice 6 (auth + analytics + errors).** Broad and shallow; good last sweep.

## Cross-cutting work to schedule once, not per slice

-   **A SignalR fake.** BR-PRI-3, BR-ORD-6 and BR-DEL-1 are all _"real-time, never polls"_ rules,
    and none of them is testable today — the harness aborts the hub connection. Without this,
    slices 3 and 5 can audit those screens' static states only. Roughly a day; do it before slice 3.
-   **`data-testid` coverage.** Only 10 templates carry hooks; slice 1 leaned on Vietnamese copy
    for its selectors, which breaks the moment a string changes or the run switches locale. Add
    hooks to the surfaces each slice touches, as part of that slice.
-   **A second locale pass.** Everything so far runs in `vi` (the default). Bilingual vi/en is a
    constitution requirement, so add an `en` run — for the highest-traffic screens, not all of them.
-   **CI wiring.** The deterministic layer belongs beside `precheck`, but only once the slice-1
    findings are either fixed or explicitly baselined. Wiring it red on day one trains everyone to
    ignore it.

## One judgement call for you

Slice 2 can start immediately, or the five high findings from slice 1 (F-01…F-05) can be fixed
first so the suite is green before it grows. Fixing first is the smaller total effort — F-02 in
particular needs a decision with the backend about whether `CancelOrderRequest.reason` is
required, and that answer is cheaper to get now than after four more slices have accumulated
around it.
