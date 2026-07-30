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

-   **Side nav**: Fuse **vertical navigation**, built from a role-filtered navigation data set
    (`src/app/core/navigation`). Grouped by domain; collapses to icons on `md`, becomes an
    overlay drawer below `md` (see breakpoints in [`../design/TOKENS.md`](../design/TOKENS.md)).
-   **Top app bar**: logo/home, global product search (restaurant), language toggle (vi/en),
    notification bell (M11), user menu (profile, sign-out).
-   **No mega-menus, no marketing nav.** This is a tool, not a storefront.

## Layout per area

UI chrome (layout + navigation + palette) follows the **route area**, not the user's role: each
area is a group of routes sharing the same chrome, declared per route block via
`data: { area, layout, theme }` in `src/app/app.routes.ts`. Roles only gate access (`roleGuard`)
and add cross-area entry links ("Quản trị" in the storefront nav for admins; "Xem cửa hàng" in
the admin nav).

`LayoutComponent` walks the matched route path and applies both `layout` and `theme`; leaving an
area reverts to the config default, so a palette can never stay stuck on `<body>`. Today every
area points at `theme-default` (one brand — see [`../design/TOKENS.md`](../design/TOKENS.md)).
Giving an area its own palette is two lines: add the theme to `themes` in `tailwind.config.js`
(the plugin generates its `.theme-*` class) and change that route block's `data.theme`. Nothing
overrides anything — each area gets its own class.

| Area          | Routes                       | Fuse Layout  | Type       | Rationale                                                                                          |
| ------------- | ---------------------------- | ------------ | ---------- | -------------------------------------------------------------------------------------------------- |
| Storefront    | `/home`, `/catalog`, `/cart` | `enterprise` | Horizontal | Customer-facing (restaurant + guest); top nav keeps content area wide for price board and ordering |
| Admin console | `/admin`                     | `dense`      | Vertical   | Dense admin console; collapsible icon rail keeps many sections reachable without eating width      |

The app ships **exactly three layouts** — `empty` (auth/error), `enterprise`, `dense`. Every
other Fuse demo layout (classic, classy, compact, futuristic, thin, centered, material, modern)
was deleted; a future area picks one of the three or adds its own deliberately. There is also
**no separate `/ops` area**: operations work lives inside the admin console behind the mode
switch below.

After sign-in, the auth flow routes each role to its landing area (admin → `/admin`,
others → `/home`). The decision is made in the sign-in / unlock-session components once
the profile — and therefore the role — is loaded.

## Role-based menus

Within an area, the navigation set is filtered by role at build-time of the menu (not just
hidden via CSS); items without a role restriction are visible to every viewer of the area,
including guests on the public storefront.

| Group              | Restaurant | Operations |  Admin  |
| ------------------ | :--------: | :--------: | :-----: |
| Prices / Catalog   |     ✓      |     ✓      |    ✓    |
| Orders / Recurring |     ✓      |     —      | ✓ (all) |
| Credit             |     ✓      |     —      |    ✓    |
| Deliveries         |     ✓      |     ✓      |    ✓    |
| Procurement        |     —      |     ✓      |    ✓    |
| Logistics          |     —      |     ✓      |    ✓    |
| Hub                |     —      |     ✓      |    ✓    |
| Analytics          |     —      |     ✓      |    ✓    |
| Administration     |     —      |     —      |    ✓    |

## Grouping rule (all areas)

The activity flows (Ops dispatches agents → agents price & pick → hub sorts → ops builds
trips → drivers deliver → restaurant receives) are a **daily hand-off chain**. The nav mirrors
that chain:

1. **Recurring work first, reference data after.** A group of screens touched every day
   (phiên chợ, đơn hàng, cuốc giao hàng) sits above the master data behind it (sản phẩm, chợ,
   phương tiện, vùng giao). Never interleave the two in one group.
2. **Order inside a group follows the operational timeline**, not entity/CRUD alphabetics.
3. **Creating a record is a primary button on its list screen**, never a nav entry — nav
   height is reserved for destinations, not actions.
4. **One-child groups collapse into a single top-level item** (e.g. Hóa đơn).

Admin console groups, in order: `Dashboard` · `Vận hành` (phiên chợ & gom đơn, đơn hàng, cuốc
giao hàng) · `Người dùng & nhà hàng` · `Hàng hóa` · `Mạng lưới` (chợ, hub, phương tiện, vùng
giao) · `Hóa đơn` · `Hệ thống` (cấu hình phiên chợ, nhật ký) · `Liên kết`.

## Console mode switch (one account, two jobs)

Only the `admin` account exists in production today and it carries **both** the Administrator
and the Operations Manager duties. Rather than one nav listing every section, the admin console
header carries a **job switch** (`console-mode` component) with two modes:

| Mode             | Nav groups shown                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `operations`     | Dashboard · **Vận hành** · Hàng hóa · Mạng lưới · Liên kết                                   |
| `administration` | Dashboard · **Người dùng & nhà hàng** · Hàng hóa · Mạng lưới · Hóa đơn · Hệ thống · Liên kết |

Rules:

1. Master data used by both jobs (`Hàng hóa`, `Mạng lưới`) appears in **both** modes — the
   switch narrows the daily work, it does not partition the data.
2. The mode is a **view preference**, never a permission: it is persisted per browser
   (`localStorage`) and grants nothing. RBAC stays server-authoritative (BR-AUTH-4).
3. Switching returns to `/admin` — the current screen may not belong to the new job.
4. Declared per nav item via `modes` in `src/app/core/navigation/navigation.data.ts`; an item
   with no `modes` shows in both.

When a real `operations_manager` account is issued, that role locks to `operations` (no switch)
and reuses the same nav group — no new area, no duplicated screens.

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
Admin/Operations search is scoped per list screen (table filter), not global — the Fuse global
search box was removed from the admin header, it only ever queried demo data.
