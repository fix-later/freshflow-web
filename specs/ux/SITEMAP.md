# FreshFlow Web — Sitemap

**Layer:** UX. Derived from [`../product/PRD.md`](../product/PRD.md) +
[`../product/ROLE_MATRIX.md`](../product/ROLE_MATRIX.md). Routing follows the existing repo
convention: lazy `loadChildren: () => import('app/modules/<feature>/<feature>.routes')` under a
shared `LayoutComponent`, guarded by `AuthGuard` / `NoAuthGuard` (see `src/app/app.routes.ts`).

## Route tree

### Public (guest, `NoAuthGuard`, `layout: 'empty'`)

```
/sign-in
/sign-up                 → restaurant self-registration (→ PENDING_APPROVAL)
/forgot-password
/reset-password
/confirmation-required   → email verification gate
```

### Authenticated shell (`AuthGuard`, role-filtered nav)

Layout is selected per area (see [`NAVIGATION.md`](./NAVIGATION.md) § Layout per area):
Storefront → `enterprise`, Admin console → `dense`, auth/error screens → `empty`. These are the
only three layouts the app ships (see [`NAVIGATION.md`](./NAVIGATION.md) § Layout per area).

```
/                        → redirect to role landing
/sign-out
/unlock-session

# ── Restaurant (layout: 'enterprise') ──────
/prices                  M4  live market price board (landing for restaurant)
/catalog                 M3  browse / search products
/catalog/:productId      M3  product detail
/orders                  M5  order list (own)
/orders/new              M5  order builder (draft)
/orders/:orderId         M5  order detail + real-time status
/orders/recurring        M5  recurring schedules
/credit                  M6  credit overview + statements
/credit/statements/:id   M6  statement detail
/deliveries              M10 delivery tracking (own)
/profile                 M2  personal + restaurant profile, addresses
/notifications           M11 notification center

# ── Operations Manager (inside the admin console, mode: 'operations') ──
/ops                     M12 operations dashboard (landing for ops)
/ops/procurement         M7  batches & manifests
/ops/procurement/:batchId M7 batch detail / monitor
/ops/logistics/routes    M9  route options & review
/ops/logistics/routes/:id M9 route detail
/ops/hub                 M8  hub inbound/outbound & discrepancy oversight
/ops/deliveries          M10 delivery performance monitoring

# ── Admin (layout: 'dense', mode: 'administration') ───────────────
/admin                   M12 admin dashboard (landing for admin)
/admin/users             M13 user accounts
/admin/restaurants       M13 restaurant approval & profiles
/admin/catalog           M3  product / category / unit management
/admin/markets           M3  wholesale markets & agent assignment
/admin/hubs              M8  hub management
/admin/vehicles          M9  vehicles & delivery zones
/admin/pricing/history   M4  price history
/admin/credit            M6  credit limits & debt adjustments
/admin/config            M13 system configuration (cutoff, batching, thresholds)
/admin/audit             M13 audit log
```

> Paths above are the **target IA**; the repo reaches it feature-by-feature, keeping the
> lazy-route convention. Do not introduce NgModules. The Fuse demo routes and their mock API
> have been removed — every screen that ships now talks to the real backend via `src/contract`.

## Landing per role

| Role               | Landing route                 |
| ------------------ | ----------------------------- |
| Restaurant         | `/prices`                     |
| Operations Manager | `/admin` (mode: `operations`) |
| Admin              | `/admin`                      |

## Depth rule

Maximum **3 levels** deep (`section / list / detail`). Anything deeper becomes a tab, drawer,
or dialog within the detail screen — not a new route level (see
[`SCREEN_RULES.md`](./SCREEN_RULES.md)).
