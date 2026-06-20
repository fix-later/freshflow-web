# FreshFlow Web — Navigation

**Layer:** UX. Implements the [`SITEMAP.md`](./SITEMAP.md) within the Fuse layout system and
the role rules in [`../product/ROLE_MATRIX.md`](../product/ROLE_MATRIX.md).

## Navigation model

FreshFlow web is an **operational console** (Google Workspace style): a persistent **left side
navigation** for primary sections + a slim **top app bar** for global actions. This favors
dense, content-first work over marketing chrome.

```
┌─────────────────────────────────────────────────────────────┐
│ Top app bar:  [logo]  [global search]      [lang] [notif] [user] │
├───────────┬─────────────────────────────────────────────────┤
│ Side nav  │  Breadcrumb                                       │
│ (role-    │  ───────────────────────────────────────────────  │
│  filtered)│  Page content (list / detail / dashboard / form)  │
│           │                                                   │
└───────────┴─────────────────────────────────────────────────┘
```

- **Side nav**: Fuse **vertical navigation**, built from a role-filtered navigation data set
  (`src/app/core/navigation`). Grouped by domain; collapses to icons on `md`, becomes an
  overlay drawer below `md` (see breakpoints in [`../design/TOKENS.md`](../design/TOKENS.md)).
- **Top app bar**: logo/home, global product search (restaurant), language toggle (vi/en),
  notification bell (M11), user menu (profile, sign-out).
- **No mega-menus, no marketing nav.** This is a tool, not a storefront.

## Role-based menus

The navigation set is filtered by role at build-time of the menu (not just hidden via CSS).

| Group | Restaurant | Operations | Admin |
|-------|:----------:|:----------:|:-----:|
| Prices / Catalog | ✓ | ✓ | ✓ |
| Orders / Recurring | ✓ | — | ✓ (all) |
| Credit | ✓ | — | ✓ |
| Deliveries | ✓ | ✓ | ✓ |
| Procurement | — | ✓ | ✓ |
| Logistics | — | ✓ | ✓ |
| Hub | — | ✓ | ✓ |
| Analytics | — | ✓ | ✓ |
| Administration | — | — | ✓ |

## Wayfinding rules

1. **Breadcrumbs** on every detail screen reflect the route hierarchy (max 3 levels).
2. **Active state** — the side nav highlights the active section; sub-routes keep the parent
   group expanded.
3. **Deep-linking** — every list/detail is directly addressable; guards redirect unauthorized
   or unauthenticated deep-links (`AuthGuard`, then RBAC).
4. **Approval gate** — a `PENDING_APPROVAL` restaurant sees nav but ordering actions are
   disabled with an inline explanation (BR-AUTH-1).
5. **Back/cancel** from a detail or form returns to the originating list, preserving its
   filters/scroll (state lives in the list's signal store — see
   [`../engineering/STATE.md`](../engineering/STATE.md)).
6. **Notifications** open a panel from the top bar; clicking an item deep-links to the related
   record (order, delivery, statement).

## Global search

Restaurant top-bar search targets the **product catalog / price board** (most frequent task).
Admin/Operations search is scoped per list screen (table filter), not global.
