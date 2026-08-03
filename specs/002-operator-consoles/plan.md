# Plan — Operator consoles & remaining API coverage

| | |
|---|---|
| Date | 2026-08-02 |
| Status | Planning — not started |
| Sources | `D:\Thesis\freshflow-backend\docs\diagrams\02F-role-flows.md` (2026-07-29, authoritative) · live swagger snapshot `src/contract/openapi.json` |
| Precedence | Business → UX → Design → Engineering → AI |

## Context

The typed client was just regenerated from the live API. A coverage scan across
`src/contract/generated/apis/` versus every `apiV1*` call site in `src/app` shows
**135 of 189 operations wired, 54 unwired**.

The unwired half is not scattered — it is three whole roles the web app does not
model at all. The backend defines six roles (`02F-role-flows.md` §1); the app's
`UserRole` in [user.types.ts:2](src/app/core/user/user.types.ts#L2) has three, and
`Area` in [navigation.types.ts](src/app/core/navigation/navigation.types.ts) has two
(`storefront`, `admin`). Market Agent, Hub Staff and Driver have no route, no nav,
no guard, and no service.

That is why the goods pipeline the backend implements —
`Agent buys → hands over to Hub → Hub sorts → Driver delivers` — cannot be
exercised end to end from the browser today. Everything between "restaurant
confirms" and "admin watches a route" is API-only.

**Outcome:** every documented role can do its job in the app, and the 54 unwired
operations drop to the handful that are genuinely out of scope.

## Where the 54 unwired operations sit

| Bucket | Ops | Notes |
|---|---:|---|
| **Driver console** | 8 | `DriverApi` 0/8 — entire role |
| **Hub Staff console** | 13 | `HubInbound` writes (8) + `HubHandover` 0/4 + `hubs/assigned` |
| **Market Agent console** | 7 | `ProcurementApi` 0/6 + `pricing/assigned-markets` |
| **Restaurant order lifecycle** | 10 | draft item CRUD (4), `confirm-preview`, `issues`, `receipt`, `advance-status`, scheduled create/patch |
| Assistant · push devices · email verify | 5 | `assistant/chat`, `notifications/devices` ×2, `auth/verify` ×2 |
| Detail GETs & upload signatures | 11 | `products/{id}`, `units/{id}`, `vehicles/{id}`, price history, `order-groups/progress`, avatar + business-license signatures, credit statement detail, shipping estimate |

Scheduled orders and order history are already wired in untracked WIP under
[src/app/modules/restaurant/scheduled-orders/](src/app/modules/restaurant/scheduled-orders/) —
that work is in flight and excluded from the counts above where already done.

## Sequencing

**Market Agent → Hub Staff → Driver**, following the physical path of the goods.
Each phase produces the data the next one consumes, so end-to-end testing works
without seeding fixtures: an agent's handover creates the hub's inbound, and the
hub's outbound + handover creates the driver's pickup. Building Driver first would
mean hand-crafting database state to see anything.

Phase 0 is a hard prerequisite for all three.

---

## Phase 0 — Role & area foundations

Small but blocking. No new screens.

- Widen `UserRole` to the six seeded role names (`admin`, `operations_manager`,
  `restaurant`, `market_agent`, `hub_staff`, `driver`) —
  [user.types.ts](src/app/core/user/user.types.ts). Names must match the backend
  seed exactly (`02F-role-flows.md` §5).
- Add a third `Area`: `'field'` — the operator consoles. Distinct from `admin`
  because the chrome differs (mobile-first, no console-mode split).
- Pick the field layout. Recommend a new minimal layout beside
  [dense/](src/app/layout/layouts/vertical/dense/) rather than reusing it: field
  screens want a title bar, no sidebar, and a sticky action bar. Reuse the
  existing `LayoutComponent` area/theme plumbing unchanged.
- Nav entries per role in [navigation.data.ts](src/app/core/navigation/navigation.data.ts),
  using the menus in `02F-role-flows.md` §6 verbatim. `buildNavigation(area, role, mode)`
  already filters by role — no signature change.
- Route blocks in [app.routes.ts](src/app/app.routes.ts) guarded by the existing
  `roleGuard([...])` factory ([role.guard.ts](src/app/core/auth/guards/role.guard.ts)).
  Hub and route endpoints also accept `admin`/`operations_manager`, so guards should
  allow those too — matching the API's RBAC rather than being stricter.
- Post-login landing per role in the sign-in component (it already branches on the
  loaded profile).

**Extract first, then reuse:** the Cloudinary signed-upload flow currently lives as
`_uploadImage` inside [catalog-admin.service.ts](src/app/modules/admin/catalog/catalog-admin.service.ts).
Phases 1–3 add four more call sites (procurement exception proof, proof of delivery,
avatar, business licence). Move it to `app/core/api/` as a shared helper taking a
signature-minting callback — the signature shape is identical across all six endpoints.

---

## Phase 1 — Market Agent console (7 ops)

Menu (§6): Assigned Markets · Price & Stock · Procurement Tasks · Exceptions.

| Screen | Endpoints | Pattern |
|---|---|---|
| Assigned markets | `pricing/assigned-markets` | Plain list, tap to enter |
| Price & stock | existing `markets/{id}/products` + price/quantity PATCH | Row = product, inline price field + qty stepper, save-on-blur |
| Task list | `procurement/tasks` | Grouped by batch, status pill, order count |
| Task detail / purchase | `procurement/tasks/{batchId}`, `.../purchase` | Line-by-line actual qty + actual unit price |
| Exception | `.../exceptions`, `.../exceptions/upload-signature` | Photo + reason, blocks nothing |
| Handover | `.../handover` | Single confirm |

**Design references.** The purchase screen is the crux: a shopping list where each
line captures what was *actually* bought, which may differ from what was ordered.
[Shipt — Items in order](https://mobbin.com/screens/83ecf73b-db87-474d-8f10-b02be7e5a04c)
is the closest match: product row with price, a qty stepper, and a secondary
"Backup / Note" strip under each line — map that strip to the exception state
(`Unavailable` / `Damaged` / `Substituted`) so an exception reads as an annotation on
the line rather than a separate screen.
[Target — list with Scan / Add](https://mobbin.com/screens/0d21d035-6c86-4b97-8b87-38b20a0b5fd8)
gives the task-list shape: checkbox rows, quantity and location as secondary text,
one primary CTA pinned at the bottom.

**Rules to honour** (§4.4): only assigned markets are editable; only batches assigned
to that agent are visible; handover sends no `hubId` (resolved server-side); handover
is rejected before the batch reaches `Purchasing`. Purchase confirm requires exactly
one line per non-exempt batch item, with qty and price both > 0 — validate client-side
before submitting so the agent isn't bounced by a 400 after typing 30 lines.

---

## Phase 2 — Hub Staff console (13 ops)

Menu (§6): My Hubs · Pending Inbound · Procurement Plan · Sorting · Routes ·
Loading Manifest · Outbound · Handovers.

| Screen | Endpoints | Pattern |
|---|---|---|
| Hub picker | `hubs/assigned` | Sets hub context for every other screen |
| Pending inbound / plan | existing `pending-inbound`, `procurement-plan` | Already in `LogisticsAdminService` — reuse |
| Scan inbound | `hubs/scan`, `hubs/{id}/inbound` | Camera + manual code fallback |
| Discrepancy | `inbound/{id}/discrepancy` | Photo + reason |
| **Sorting** | `hubs/{id}/sorting`, `sorting-progress`, `routes/{id}/loading-manifest` | Checklist, grouped by restaurant |
| Routes (hub-scoped) | existing routes list with `hub_id` | Filter already added |
| Outbound + handover | `outbound`, `handover`, `handovers`, `drivers/eligible` | Driver picker → confirm |

**Sorting is the screen to get right.** The backend deliberately did *not* merge
sorting state into the loading manifest — `AUDIT-2026-07-28-hub-sorting-driver-handover-plan.md`
§3 decision 2 resolves it as **"FE merge"**: call `/routes/{id}/loading-manifest` and
`/hubs/{hubId}/sorting-progress` and join them on `orderItemId` client-side. Budget for
that join; it is not a bug in the API.

Note the shipped API is **hub + serviceDate** scoped, not route-scoped as that doc
proposed — `POST /hubs/{hubId}/sorting` takes `{ serviceDate, orderItemId, sortedQuantityKg }`.
`getSortingProgress(hubId, serviceDate)` in
[logistics-admin.service.ts](src/app/modules/admin/logistics/logistics-admin.service.ts)
already reads the shipped shape; the matching write method does not exist yet and is
part of this phase.

**Design references.**
[Target's checklist](https://mobbin.com/screens/0d21d035-6c86-4b97-8b87-38b20a0b5fd8)
is the sorting list: a checkbox per order line, product name primary, "Qty × unit —
restaurant name" secondary, with the Scan affordance promoted to the top of the list
rather than buried in a toolbar. Add a progress header (`n / m lines sorted`) driven by
the merged progress response.
[UNIQLO — Scan](https://mobbin.com/screens/62fa4fba-988b-4c80-9ed6-94ba9fcfd38d)
is the inbound scan screen: full-bleed scan area, an always-available **"Enter barcode"**
manual fallback, and scan history below. The manual fallback is not optional here —
hub lighting and damaged labels are the normal case.

**Rules to honour** (§4.5): hub access requires an active assignment (admin/ops bypass);
hub staff may view and assign routes for their hub but may not calculate/select/optimize/
review; hub staff may **not** acknowledge discrepancies (admin/ops only) — hide the action,
don't just let it 403. Scanning past hub capacity fails with `HUB_CAPACITY_EXCEEDED`;
surface that as a specific message, not a generic error.

---

## Phase 3 — Driver console (8 ops)

Menu (§6): Today Routes · Pickup · Current Delivery · Proof/Issues · History.

| Screen | Endpoints | Pattern |
|---|---|---|
| Today | `driver/routes/today` | One route card + stop list |
| Reorder stops | `.../reorder` | Drag list, `assigned` status only |
| Pickup | `.../confirm-pickup` | Must send **all** `AtHub` order ids |
| Start | `.../start` | Blocked while any discrepancy is `OPEN` |
| Delivery status | `deliveries/{id}/status` | `pending → arrived → delivered \| failed` |
| Proof of delivery | `.../proof-of-delivery`, `.../upload-signature` | Photo capture |
| Issue | `.../issues` | Reason + photo |

**Design references.**
[DoorDash Dasher — Current dash](https://mobbin.com/screens/5859ffb5-02a0-45ee-9065-2ea87eaf43fa)
is the model for Today: map on top, then a *sequential task list* where exactly one row
carries a "Current task" badge and the rest are dimmed. That single-focus framing maps
directly onto the delivery state machine (§3.4) — the driver always has one next action.
[DoorDash Dasher — Confirm pickup](https://mobbin.com/screens/5cb6f086-abb8-4751-874a-e2901cb238e3)
is the pickup screen: a stack of instruction cards with one sticky primary CTA at the
bottom. Use it for the all-or-nothing pickup confirm, and show the order count being
confirmed on the button itself.

**Rules to honour** (§4.6): confirm-pickup must send exactly the full set of `AtHub`
orders for the route's restaurants, hub and service date — a partial set fails with
`PICKUP_ORDERS_INCOMPLETE`, so build the payload from the route, never from user
selection. Only `assigned` routes may reorder/pickup/start; only `in_progress` routes
may update deliveries. A `FAILED` delivery leaves the order in `Delivering` (§7.4) —
don't render it as terminal.

---

## Phase 4 — Restaurant lifecycle gaps (10 ops)

Smaller, and independent of Phases 1–3.

- **`GET /orders/{id}/confirm-preview`** — the highest-value one. It returns the
  server's verdict on the approval / cutoff / credit gates *before* the restaurant
  commits (§4.3). Today [checkout.component.ts](src/app/modules/cart/checkout.component.ts)
  discovers those failures only on submit.
- **`PATCH /orders/{id}/receipt`** and **`POST /orders/{id}/issues`** — close the loop
  after delivery; both appear in the restaurant flow and neither has UI.
- **Draft item CRUD** (`items` POST/PUT/DELETE, `actual-quantity`) — deliberate gap
  today: the app builds the cart client-side in `DraftOrderService` and posts once. Wiring
  these only matters if a draft must be editable after creation (e.g. resuming a
  scheduled-order draft). Decide before building.
- **`advance-status`** belongs to the admin/ops console, not the storefront.

---

## Phase 5 — Small wiring wins

Independent, each under an hour: `order-groups/progress` on the order-groups page ·
shipping estimate on admin order detail · price history on market products ·
avatar and business-licence upload signatures (once the Phase 0 helper exists) ·
credit statement detail · `products/{id}` · `units/{id}` · `vehicles/{id}`.

## Known gap, out of scope unless raised

The backend runs **SignalR with a Redis backplane** for live price and order-status
updates (`00-index.md` §2). The web app has no SignalR client — no `@microsoft/signalr`
dependency, no hub connection anywhere in `src/app`. Every screen polls or reloads.
This is a real divergence from the architecture doc and worth a decision, but it is a
separate piece of work from API coverage.

## Verification

Per phase, not at the end:

1. `npm run precheck` — lint → Prettier → contrast → tests → production build. Never bypass.
2. Drive the real app with the `/verify` skill against each new console, signed in as
   that role. Screens are useless if the role's guard or nav is wrong, and neither shows
   up in unit tests.
3. **End-to-end chain after Phase 3**, one order the whole way: restaurant confirms →
   admin auto-batches → agent purchases and hands over → hub scans, sorts, records
   outbound and hands over → driver picks up, starts, delivers → restaurant confirms
   receipt. This is the acceptance test for the whole plan; anything less leaves an
   untested seam.
4. Re-run the coverage scan and confirm the unwired count fell as predicted.

## Open decisions

1. **Field layout** — new minimal mobile-first layout (recommended) vs reusing `dense`.
2. **Draft item CRUD** — wire it, or keep the client-side cart as the only path?
3. **Ops-manager reach** — `operations_manager` currently has admin-console access via
   `UserRole` but the console is guarded `admin` only. §4.2 says ops should be excluded
   from user/catalog/procurement admin. Split the console by role, or accept the gap?
