# FreshFlow Web — Role / Permission Matrix

**Layer:** Business. Derived from actors and use cases in [`UseCase.xlsx`](./UseCase.xlsx) and
[`PRD.md`](./PRD.md). RBAC is **server-authoritative** (BR-AUTH-4); this matrix drives **what
the web UI exposes** per role. The UI must also degrade gracefully on a server `403`.

## Roles

| Role | Code | Surface |
|------|------|---------|
| Restaurant Manager | `restaurant` | **Web** |
| Admin | `admin` | **Web** |
| Operations Manager | `operations_manager` | **Web** |
| Market Agent | `market_agent` | Mobile |
| Hub Staff | `hub_staff` | Mobile |
| Driver | `driver` | Mobile |

> This repo implements the **web** roles. Mobile roles are listed for completeness; their
> screens are out of scope here (PRD § 9 Scope).

## Capability matrix (web surfaces)

Legend: **F** = full (CRUD/act) · **R** = read-only · **R⁺** = read own records ·
**A** = approve/configure · **—** = no access.

| Module | Capability | Restaurant | Operations | Admin |
|--------|-----------|:----------:|:----------:|:-----:|
| M1 Auth | Own session, profile auth | F | F | F |
| M1 Auth | Manage RBAC / roles | — | — | A |
| M2 Profile | Own personal profile | F | F | F |
| M2 Profile | Restaurant profile & addresses | F | R | F |
| M3 Catalog | Browse / search products | R | R | R |
| M3 Catalog | Product / category / unit CRUD | — | — | F |
| M3 Catalog | Markets & agent assignment | — | A | F |
| M4 Pricing | Live price board | R | R | R |
| M4 Pricing | Price history / change detail | — | R | R |
| M4 Pricing | Price-alert thresholds | R⁺ | — | A |
| M5 Orders | Create / edit / cancel own orders | R⁺ F | — | F |
| M5 Orders | Recurring orders | F | — | R |
| M5 Orders | View all orders | R⁺ | R | R |
| M6 Credit | Own credit / statements | R⁺ | — | R |
| M6 Credit | Record payment / adjust debt | — | — | F |
| M6 Credit | Configure credit limit | — | — | A |
| M7 Procurement | Batches / manifests | — | F | R |
| M7 Procurement | Assign agents, monitor | — | F | R |
| M8 Hub | Hub management | — | R | F |
| M8 Hub | Inbound/outbound & discrepancy oversight | — | R | R |
| M9 Logistics | Route options / VRP / review | — | F | R |
| M9 Logistics | Vehicles & delivery zones | — | R | F |
| M10 Delivery | Track delivery status | R⁺ | R | R |
| M11 Notifications | Own notifications | F | F | F |
| M12 Analytics | Operations dashboards | — | R | R |
| M12 Analytics | Price-trend / heatmap / export | R⁺ | R | F |
| M13 Admin | Approve restaurants | — | — | A |
| M13 Admin | System configuration | — | R | A |
| M13 Admin | Audit log | — | — | R |

## UI enforcement rules

1. **Navigation is role-filtered** — menu items render only for permitted modules
   (see [`../ux/NAVIGATION.md`](../ux/NAVIGATION.md)).
2. **Route guards** protect every authenticated route; unauthorized deep-links redirect.
3. **Action-level gating** — buttons/menus for `F`/`A` capabilities are hidden for `R`/`—` roles.
4. **Ownership scoping** — `R⁺` views filter to the signed-in restaurant's own records.
5. **Approval gate** — a `PENDING_APPROVAL` restaurant can sign in and view, but ordering
   actions are disabled until approved (BR-AUTH-1).
