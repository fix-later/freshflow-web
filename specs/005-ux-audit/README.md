# 005 — Spec-traced UX/UI audit

**Layer:** Engineering (verification). **Status:** slice 1 delivered.

A UX audit of this app cannot be a screenshot sweep of every route. The failures that matter
in a B2B post-paid marketplace are not "the card is misaligned" — they are _the screen is
pretty and says the wrong thing for the state the account is in_: a `PENDING_APPROVAL`
restaurant that can still reach a checkout, a batched order that still offers a Cancel button,
a list that claims "no orders" while it is still loading.

So the unit of audit here is not the screen. It is **role × screen × business state**, and every
row is traced to an invariant that already exists in the specs — `BR-*` in
[`../product/BUSINESS_RULES.md`](../product/BUSINESS_RULES.md), the capability grid in
[`../product/ROLE_MATRIX.md`](../product/ROLE_MATRIX.md), the required states in
[`../ux/SCREEN_RULES.md`](../ux/SCREEN_RULES.md). A finding with no trace is an opinion and
does not belong in the report.

## Two layers

| Layer             | What it decides                                                                                                                                                      | Where                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Deterministic** | route guards and redirects, action visibility per role/state, the five required states, axe-core violations, console errors, which endpoints a screen actually calls | [`scripts/ux-audit/run.mjs`](../../scripts/ux-audit/run.mjs) |
| **Judgement**     | hierarchy, whether one primary action reads as primary, whether the copy explains _why_ something is blocked, whether an empty state offers the right next step      | screenshot review against `SCREEN_RULES` + `BUSINESS_RULES`  |

The deterministic layer is cheap and repeatable — it belongs next to `precheck`. The judgement
layer is not, so it runs per slice, not per commit.

## Why everything is stubbed

Every `/api/v1/**` call is answered from [`scripts/ux-audit/fixtures.mjs`](../../scripts/ux-audit/fixtures.mjs)
and every other off-origin request except web fonts is aborted. Three reasons, in order:

1. The states worth auditing — over the credit limit, past the cutoff, an order already
   batched, a 500 on the list — **cannot be produced on demand** against a live backend.
2. `apiBaseUrl` points at a **real deployed API**. A suite that drove it would be writing to it.
3. A screenshot baseline that moves with today's data is not a baseline.

The consequence is stated plainly: this verifies **that the UI reflects the rule**, not that the
backend enforces it. Rules marked _Server-authoritative_ still need contract tests on the API
side; that is a different suite and out of scope here.

## Running it

The dev server must be up (`.claude/launch.json` → `freshflow-verify`, port 4300).

```bash
npm i playwright-core axe-core --no-save --prefix /tmp/ux-audit && UX_AUDIT_MODULES=/tmp/ux-audit/node_modules node scripts/ux-audit/run.mjs --base http://localhost:4300 --out .ux-audit
```

`playwright-core` drives the system Chrome (`channel: 'chrome'`) — no browser download — and
neither package is added to the app's dependency tree; `UX_AUDIT_MODULES` points the harness at
wherever they were installed. Use `--only M5-06,M5-08` to re-run single rows.

Output: `report.json` plus `shots/<id>-<viewport>.png` (full page, for content) and
`shots/<id>-<viewport>-fold.png` (viewport only — a full-page capture relocates sticky chrome
and reads as a layout bug that is not there).

## Coverage

| Slice | Modules                                     | Scenarios         | Status                                                    |
| ----- | ------------------------------------------- | ----------------- | --------------------------------------------------------- |
| 1     | M1 auth/approval gate, M5 orders + checkout | 20 rows / 25 runs | done — see [`findings-slice-1.md`](./findings-slice-1.md) |
| 2–6   | see [`SLICE-PLAN.md`](./SLICE-PLAN.md)      | ~106 rows         | planned                                                   |

## Files

-   [`scripts/ux-audit/scenarios.mjs`](../../scripts/ux-audit/scenarios.mjs) — the matrix; one
    entry per `role × screen × state`, each carrying its `traces`.
-   [`scripts/ux-audit/fixtures.mjs`](../../scripts/ux-audit/fixtures.mjs) — API payloads. Shapes
    mirror what the app parses, including the places where list and detail spell the same field
    differently (`productName` vs `productNameSnapshot`).
-   [`scripts/ux-audit/run.mjs`](../../scripts/ux-audit/run.mjs) — the driver.
