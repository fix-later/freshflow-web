# FreshFlow Web — Product Requirements (PRD)

**Layer:** Business (authoritative — top of the precedence chain).
**Source data:** [`UseCase.xlsx`](./UseCase.xlsx) (full UC IDs, actors, descriptions).
**Precedence for any cross-doc conflict:** Business → UX → Design → Engineering → AI.

> This is the canonical product document. If any other spec disagrees on *what the product
> does*, this file wins. Detailed invariants live in [`BUSINESS_RULES.md`](./BUSINESS_RULES.md);
> permissions in [`ROLE_MATRIX.md`](./ROLE_MATRIX.md).

## 1. Vision

FreshFlow (FFX) is a **B2B intermediary platform** that connects Ho Chi Minh City restaurants
to wholesale markets (Hóc Môn, Bình Điền, Thủ Đức), optimizing procurement and last-mile
logistics. This repository is the **Angular web client** serving the **Restaurant, Admin, and
Operations Manager** surfaces. Market Agent, Hub Staff, and Driver use mobile apps.

## 2. Business Goals

| Goal | How the web client serves it |
|------|------------------------------|
| Price transparency | Live, real-time market price board for restaurants |
| Procurement efficiency | Cutoff-based order aggregation, batching, and manifests for Operations |
| Logistics optimization | Route review and delivery monitoring dashboards |
| Reliable B2B settlement | Credit/debt tracking, statements, and recorded payments |
| Operational visibility | Analytics dashboards across orders, hub, delivery, and price trends |

## 3. Actors

| Actor | Surface | Goals |
|-------|---------|-------|
| Restaurant Manager | Web | See prices, order (one-off + recurring), track delivery, manage credit & profile |
| Admin | Web | Manage users/catalog/markets/hubs/vehicles, configure system, audit |
| Operations Manager | Web | Oversee procurement, batching, route review, monitoring |
| Market Agent | Mobile | Update prices/quantities, purchase, hand off to hub |
| Hub Staff | Mobile | Receive/check goods, flag discrepancies, hand off to driver |
| Driver | Mobile | Run routes, update stops, capture proof of delivery |
| System | — | Cutoff aggregation, batching, route generation, notifications, recurring orders |

## 4. Module Map (13 modules)

The canonical module taxonomy. Codes are used as prefixes throughout the specs.

| # | Module | Code | UCs | Primary roles |
|---|--------|------|-----|---------------|
| 1 | Auth & Authorization | FR-AUTH | 11 | All |
| 2 | Account & Profile Management | FR-PROF | 6 | Restaurant, All |
| 3 | Catalog & Market Management | FR-CAT | 8 | Admin, Market Agent, Restaurant |
| 4 | Pricing Management | FR-PRI | 14 | Market Agent, Restaurant, Admin |
| 5 | Order Management | FR-ORD | 21 | Restaurant, Admin, Operations |
| 6 | B2B Credit / Debt Management | FR-CRE | 8 | Restaurant, Admin |
| 7 | Procurement Management | FR-PROC | 12 | Operations, Market Agent |
| 8 | Hub Management | FR-HUB | 13 | Hub Staff, Admin, Operations |
| 9 | Logistics Optimization | FR-LOG | 14 | Operations, Admin |
| 10 | Delivery Management | FR-DEL | 10 | Driver, System |
| 11 | Notifications | FR-NOT | 10 | All |
| 12 | Analytics & Dashboard | FR-ANA | 10 | Admin, Operations |
| 13 | Admin & System Configuration | FR-ADM | 10 | Admin |

## 5. Module Workflows (web)

### M1 · Auth & Authorization (FR-AUTH)
Login (email/phone + password), self-registration → `PENDING_APPROVAL`, forgot/reset/change
password, email verification, session refresh & expiry handling, account lock, RBAC.

### M2 · Account & Profile (FR-PROF)
View/update personal profile; Restaurant profile (name, address, contact, receiving window);
manage delivery addresses; view approval status.

### M3 · Catalog & Market (FR-CAT)
Browse / search / filter products; view details; Admin product CRUD; categories & units;
wholesale market management; assign markets to agents.

### M4 · Pricing (FR-PRI)
Restaurant: **live price board** + price-change detail + price-alert thresholds. Admin: price
history. (Market Agent price entry is mobile.) Price is **locked at order confirmation**.

### M5 · Orders (FR-ORD)
Draft → add/update/remove items → validate → **confirm before 22:00 cutoff** → snapshot price.
One-off and **recurring** orders; list/detail; **real-time status**; cancel (with reason)
while allowed; confirm receipt; report issue; history; re-order.

### M6 · B2B Credit / Debt (FR-CRE)
Credit overview (balance, limit, remaining); transaction history; periodic statements; record
payment; credit-limit alerts; debt adjustment after discrepancy. **(See RC-1: post-paid, no
gateway checkout.)**

### M7 · Procurement (FR-PROC)
Operations: aggregate CONFIRMED orders after cutoff; group by market source & delivery area;
generate batch & manifest; assign agents; monitor progress. (Agent purchase/handover is mobile.)

### M8 · Hub (FR-HUB)
Admin: hub management. Operations/Admin: inbound/outbound history, discrepancy oversight.
(Receive/scan/flag/handover is mobile Hub Staff.)

### M9 · Logistics (FR-LOG)
Generate route options (Market→Hub→Restaurant or Market→Restaurant); VRP optimization;
multi-drop; capacity & driver checks; assign vehicle/driver; review & approve routes; manage
vehicles and delivery zones.

### M10 · Delivery (FR-DEL)
Restaurant + Operations: real-time delivery tracking and performance. (Driver execution is mobile.)

### M11 · Notifications (FR-NOT)
In-app list, read state, history; real-time push for price / order / hub / delivery / credit.
**No SMS/email in v1 (RC-4).**

### M12 · Analytics & Dashboard (FR-ANA)
Operations dashboard, order/hub/delivery monitoring, price-trend summary, demand heatmap,
completion rate, recent activity, CSV export. (Read-only; charts via ApexCharts.)

### M13 · Admin & System Configuration (FR-ADM)
User accounts; approve restaurants; restaurant profiles; configure cutoff / batching /
hub-vs-direct / credit limit / price thresholds; audit log; kiosk configuration.

## 6. Core Business Flow

```
Market Agent updates price  →  Restaurant sees live board (real-time)
  →  Restaurant places order before 22:00 cutoff  →  price snapshot stored
  →  22:00: orders aggregated into procurement batches (by market + delivery area)
  →  Market Agent buys & hands off to Hub  →  Hub receives/checks, flags discrepancies
  →  Logistics builds optimized routes (Market→Hub→Restaurant or Market→Restaurant)
  →  Driver delivers, captures proof  →  order recorded to restaurant's credit (debt)
  →  periodic statement  →  debt payment recorded
```

## 7. Resolved Conflicts (Business-first)

Genuine contradictions between the use-case file and the backend engineering spec, resolved in
favor of the Business layer and recorded so the decision is explicit and reversible.

| # | Conflict | Decision (authoritative) |
|---|----------|--------------------------|
| RC-1 | **Payment model.** Backend assumed prepaid gateways (VNPay/MoMo/ZaloPay). UseCase defines a B2B Credit/Debt module. | **B2B post-paid credit/debt.** Delivered orders accrue to the restaurant's balance; settlement by periodic statement + recorded payment. No consumer payment-gateway checkout in v1. |
| RC-2 | **Restaurant onboarding.** Backend deferred self-registration. UseCase UC-AUTH-11 includes it. | **Self-registration with Admin approval.** Self-register → `PENDING_APPROVAL` → Admin approves (UC-ADM-02) before ordering. |
| RC-3 | **Module taxonomy.** Backend grouped into 7 modules. UseCase defines 13. | **13-module taxonomy (§4) is canonical.** Profile, Catalog, Credit/Debt, Procurement, Delivery are first-class. |
| RC-4 | **Notification channels.** Backend excluded SMS/email; UseCase adds device push. | **In-app + SignalR real-time + device push.** No SMS/email in v1. |

## 8. Success Metrics (web)

- Restaurant can locate a product on the live board and place an order in < 3 minutes.
- Price updates reflect on the board within 500 ms of broadcast (no manual refresh).
- Order status and delivery updates appear without polling.
- Admin can approve a restaurant and configure cutoff without leaving the web app.

## 9. Scope

**In scope:** Restaurant, Admin, Operations web surfaces for all 13 modules — live price board,
ordering (one-off + recurring), credit/debt, procurement & batching oversight, hub/logistics
monitoring, analytics dashboards, system configuration.

**Out of scope:** Mobile surfaces (Market Agent / Hub Staff / Driver); consumer (B2C);
multi-city expansion; SMS/email channels; accounting/ERP integration.

## 10. Cross-references

- Invariants & rules → [`BUSINESS_RULES.md`](./BUSINESS_RULES.md)
- Permissions → [`ROLE_MATRIX.md`](./ROLE_MATRIX.md)
- Screens & flows → [`../ux/`](../ux/) · Design → [`../design/`](../design/) ·
  Engineering → [`../engineering/`](../engineering/)
- Backend engineering elaboration (API/DB/NFRs) lives in `freshflow-backend/docs/` — a
  reference subordinate to this file.
