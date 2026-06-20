# FreshFlow Web — Component Rules

**Layer:** Design. Maps UX archetypes ([`../ux/SCREEN_RULES.md`](../ux/SCREEN_RULES.md)) to
**Angular Material (Material 3)** components, themed via Fuse tokens
([`TOKENS.md`](./TOKENS.md)). **Reuse before building.** **No custom CSS**; layout via Tailwind.

## Component selection

| Need | Use | Notes |
|------|-----|-------|
| Collection / list | `mat-table` + `matSort` + `mat-paginator` | **Dense**; sticky header + toolbar |
| Primary action | `mat-button` (filled) | Green primary; one per screen header |
| Secondary action | `mat-button` (outlined/text) | Quiet; group in overflow `mat-menu` |
| Create/edit (short) | `mat-dialog` + reactive form | Confirm/cancel; reason where required |
| Create/edit (long) | Routed page + sticky action bar | Multi-section forms |
| Inputs | `mat-form-field` (outline) + `mat-input`/`mat-select` | Inline validation, bilingual errors |
| Filters | `mat-form-field` + `mat-chip-listbox` | Above the table; persist in list state |
| Status | `mat-chip` / Fuse badge | Semantic color + **text/icon** (never color alone) |
| KPI cards | Fuse card + `text-mono` numbers | Low elevation; dashboard only |
| Charts | `ng-apexcharts` (ApexCharts) | Analytics/dashboards; theme-aware colors |
| Tabs (detail) | `mat-tab-group` | Keep detail at one route level |
| Side panel | `mat-sidenav` / Fuse drawer | Contextual detail without new route |
| Notifications | Fuse navigation badge + panel | Top-bar bell (M11) |
| Confirmation | `FuseConfirmationService` | Destructive actions (cancel, adjust debt, approve) |
| Empty / loading | Skeletons + empty-state block | Per [`../ux/SCREEN_RULES.md`](../ux/SCREEN_RULES.md) |

## Tables (the workhorse)

- **Dense** row height; `text-md` cells; `font-mono tabular-nums` for prices/qty/totals.
- Sticky header + toolbar; client filter/sort for small sets, server paging for large.
- Identifying column left and emphasized; status column with semantic chip; actions in a
  trailing overflow menu.
- Row click opens detail (deep-linkable); never hide the only action behind hover alone.

## Forms

- **Outline** form fields, consistent density; group related fields with generous gaps.
- Validate inline; disable submit until valid; one error summary on server rejection.
- All labels/placeholders/errors via Transloco (vi/en).

## Buttons & actions

- **One filled (green) primary** per screen/section. Everything else outlined/text/overflow.
- Destructive actions are red (`warn`) and always confirmed.
- Icon-only buttons require an `aria-label` and tooltip.

## Real-time components

- Price board cell, order-status chip, and delivery-status reflect live SignalR updates with a
  brief highlight ([`MOTION.md`](./MOTION.md)); update the changed node only, never reflow the list.

## Reuse policy

- Prefer existing **Fuse components** (`@fuse/components/*`: alert, card, navigation,
  loading-bar, drawer) and Angular Material before creating anything new.
- A new shared component is justified only when a pattern repeats ≥ 3 times and no
  Material/Fuse equivalent exists. Place it under a shared feature folder, standalone, themed by
  tokens. **Do not duplicate UI** (see [`../engineering/ANGULAR.md`](../engineering/ANGULAR.md)).
