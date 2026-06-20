# FreshFlow Web — Business Rules

**Layer:** Business. **Source:** use cases in [`UseCase.xlsx`](./UseCase.xlsx); decisions in
[`PRD.md`](./PRD.md). These are **invariants the UI must enforce or reflect** —
not invented logic. Where a use case states a value (e.g., 22:00), it is given; other
thresholds are marked **configurable** and owned by Admin (M13). The backend is the system of
record; the web client enforces these client-side for UX and re-validates server responses.

## Conventions

- **Configurable** = value set by Admin (FR-ADM); the UI reads it, never hardcodes it.
- **Server-authoritative** = the rule is enforced by the backend; the UI mirrors it and must
  handle rejection gracefully.

## Auth & Access (M1)

- **BR-AUTH-1** Restaurants self-register and start `PENDING_APPROVAL`; they **cannot place
  orders** until an Admin approves (UC-AUTH-11, UC-ADM-02). *Server-authoritative.*
- **BR-AUTH-2** Login accepts email **or** phone + password (UC-AUTH-01).
- **BR-AUTH-3** After repeated failed logins the account is **locked** for a cool-down
  (UC-AUTH-09). Count and window are *configurable*.
- **BR-AUTH-4** Every API call is **RBAC-gated**; the UI hides actions a role cannot perform
  and must still handle a server `403` (UC-AUTH-10). *Server-authoritative.*
- **BR-AUTH-5** Sessions use short-lived access + longer refresh tokens with rotation; on
  expiry the client refreshes silently, else routes to sign-in (UC-AUTH-07/08).

## Catalog & Pricing (M3, M4)

- **BR-CAT-1** Only Admin creates/edits/deactivates products; deactivation is a **soft delete**
  that preserves history (UC-CAT-04). Market Agents never create products.
- **BR-PRI-1** Price must be **> 0**; quantity must be a **non-negative integer**; quantity
  `0` marks the product **OUT_OF_STOCK** (still visible) (UC-PRI-03/04/05).
- **BR-PRI-2** Every price/quantity change writes an **immutable price snapshot**
  (product, market, value, actor, time) (UC-PRI-06). History is never edited or deleted.
- **BR-PRI-3** The restaurant **live price board** reflects the latest broadcast in real time;
  on reconnect the client re-fetches current state rather than replaying missed events
  (UC-PRI-07/08/09).
- **BR-PRI-4** Price-change **alerts** fire when movement exceeds a *configurable* threshold,
  used primarily for recurring/auto purchase (UC-PRI-11/12).

## Orders (M5)

- **BR-ORD-1** An order needs **≥ 1 line item**, each referencing an **active** product with a
  valid quantity (UC-ORD-01/05). *Server-authoritative.*
- **BR-ORD-2** The **daily cutoff is 22:00** (default; *configurable* via FR-ADM-004). Orders
  confirmed before cutoff join the next delivery cycle; later orders roll to the following cycle
  (UC-ORD-06/07).
- **BR-ORD-3** On confirmation the system stores a **price snapshot** and **locks the price**
  for that order (UC-ORD-08, UC-PRI-13). Subsequent market changes do not alter a locked order.
- **BR-ORD-4** Cancellation is allowed only while the order is in an early state (e.g., `DRAFT`
  or `CONFIRMED` **before batching**); a **cancellation reason** is required
  (UC-ORD-15/16). *Server-authoritative.*
- **BR-ORD-5** **Recurring** orders generate concrete instances on a daily/weekly schedule and
  can be paused/cancelled (UC-ORD-09/10/11).
- **BR-ORD-6** Order status is **real-time**; the UI never polls for it (UC-ORD-14).
- **BR-ORD-7** After delivery the restaurant can **confirm receipt** or **report an issue**
  (missing / wrong / damaged) (UC-ORD-18/19).

## Credit / Debt (M6)

- **BR-CRE-1** FreshFlow is **B2B post-paid**: a delivered order is recorded against the
  restaurant's **outstanding credit balance** (UC-CRE-02). There is **no consumer
  payment-gateway checkout** (PRD RC-1).
- **BR-CRE-2** Each restaurant has a **credit limit** (*configurable* per restaurant, FR-ADM-008);
  the system **alerts** as the balance nears/exceeds it (UC-CRE-07).
- **BR-CRE-3** Settlement is by **periodic statement** (UC-CRE-04/05) plus **recorded payments**
  that reduce the balance (UC-CRE-06).
- **BR-CRE-4** Hub/delivery **discrepancies adjust the debt** for affected items (UC-CRE-08).

## Procurement & Hub (M7, M8)

- **BR-PROC-1** After cutoff, **CONFIRMED** orders are **aggregated** and grouped by **market
  source** and **delivery area** into a procurement **batch + manifest** (UC-PROC-01..05).
- **BR-PROC-2** An order belongs to **at most one active batch** at a time.
- **BR-HUB-1** Goods are checked **against the manifest**; **missing/damaged/wrong** items are
  flagged (UC-HUB-04/06).
- **BR-HUB-2** An **open discrepancy blocks dispatch**, **notifies** Operations + Restaurant,
  and triggers a **credit adjustment** for affected items (UC-HUB-07, UC-CRE-08). *Server-authoritative.*

## Logistics & Delivery (M9, M10)

- **BR-LOG-1** Routes are **Market→Hub→Restaurant** or **Market→Restaurant** (direct); the model
  is chosen by order size, distance, and hub capacity (UC-LOG-01/02).
- **BR-LOG-2** Routing runs **VRP optimization** with **multi-drop** support; routes respect a
  *configurable* **stop limit** and **vehicle capacity** (UC-LOG-03/06/07).
- **BR-LOG-3** A route is assigned a vehicle + available driver before scheduling (UC-LOG-08/09/10).
- **BR-DEL-1** Drivers update stops as `ARRIVED` / `DELIVERED` / `FAILED` and capture **proof of
  delivery**; status syncs in real time to the restaurant and Operations dashboard
  (UC-DEL-05/06/08/09).

## Notifications, Analytics, Admin (M11–M13)

- **BR-NOT-1** Channels are **in-app + real-time (SignalR) + device push** only — **no
  SMS/email** in v1 (PRD RC-4). Failed sends **retry**; history is stored (UC-NOT-09/10).
- **BR-ANA-1** Dashboards are **read-only** aggregates; exports are **CSV** (UC-ANA-09).
- **BR-ADM-1** Admin owns all *configurable* values: cutoff, batching rules, hub-vs-direct rule,
  credit limits, price thresholds (UC-ADM-04..08).
- **BR-ADM-2** Sensitive actions (price change, order cancel, debt adjust) are **audit-logged**
  (UC-ADM-09).
