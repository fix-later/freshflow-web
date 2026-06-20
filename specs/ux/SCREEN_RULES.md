# FreshFlow Web — Screen Rules

**Layer:** UX. Defines reusable **page archetypes**, their hierarchy, and required states.
Visual execution is governed by [`../design/`](../design/); this file governs **structure and
behavior**. Operational, content-first, dense.

## Page archetypes

| Archetype | Used for | Primary Material surface |
|-----------|----------|--------------------------|
| **List / Table** | Orders, users, products, batches, routes, audit | `mat-table` (dense) + toolbar + paginator |
| **Detail** | Order, statement, route, batch, restaurant | header + tabs/sections, low elevation |
| **Form / Dialog** | Create/edit, approve, record payment, config | reactive form; dialog for short, page for long |
| **Dashboard** | Operations / admin overview, analytics | KPI cards + charts (ApexCharts) + recent activity |
| **Board** | Live price board, procurement batch board | dense card/row grid, real-time updates |

## Layout rules

1. **One primary action per screen**, top-right of the page/section header. Secondary actions
   are overflow or inline.
2. **Content first** — no decorative hero areas in authenticated screens. Page header = title +
   breadcrumb + primary action, then content immediately.
3. **Dense tables** — tables are the default for collections; comfortable spacing only for
   forms. Sticky header + sticky toolbar; horizontal scroll only as a last resort.
4. **Large whitespace around dense content** — generous page padding and section gaps frame
   tight data (see spacing scale in [`../design/TOKENS.md`](../design/TOKENS.md)).
5. **Low elevation** — flat sections separated by dividers/borders, not stacked shadows
   (Material 3, level 0–1 only; see [`../design/DESIGN.md`](../design/DESIGN.md)).
6. **Max 3 route levels**; deeper context uses tabs, side drawers, or dialogs.

## Required states (every data screen)

Each list/detail/board must explicitly handle:

- **Loading** — skeletons for tables/cards (not spinners for whole pages).
- **Empty** — purposeful empty state with the primary action (e.g., "No orders yet — Create order").
- **Error** — inline, retryable; preserve the user's filters/input.
- **Partial / stale** (real-time screens) — show a "reconnecting…" affordance; on reconnect,
  re-fetch current state rather than replaying (BR-PRI-3, BR-ORD-6).
- **Permission** — actions the role cannot perform are hidden, not disabled-without-reason
  (ROLE_MATRIX); approval-gated actions show an inline explanation.

## Forms

- **Reactive forms** with signal-backed view state; inline field validation with bilingual
  messages (vi/en via Transloco).
- Short, focused forms in `mat-dialog`; multi-section forms as routed pages with a sticky
  action bar.
- Disable submit until valid; show a single, clear error summary on server rejection.
- Destructive/irreversible actions (cancel order, adjust debt, approve restaurant) require a
  confirmation dialog and, where applicable, a **reason** (BR-ORD-4).

## Real-time screens

- The **price board** (M4), **order detail** (M5), and **delivery tracking** (M10) update from
  SignalR without polling. Highlight changed values briefly (see
  [`../design/MOTION.md`](../design/MOTION.md)); never reflow the whole list on a single update.

## Responsive rules

| Breakpoint | Behavior |
|------------|----------|
| `< md` (≤ 960px) | Side nav becomes overlay drawer; tables collapse to stacked rows or horizontally scroll within a card; one column. |
| `md – lg` | Side nav as icon rail (expandable); tables dense; dashboards 2-up. |
| `≥ lg` | Full side nav; dashboards 3–4-up; tables full width. |

Layout/responsive composition uses **Tailwind utilities only** (flex/grid/gap/spacing);
component styling comes from Material + theme tokens, never custom CSS
(see [`../engineering/ANGULAR.md`](../engineering/ANGULAR.md)).
