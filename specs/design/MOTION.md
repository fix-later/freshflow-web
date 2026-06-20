# FreshFlow Web — Motion

**Layer:** Design. Motion is **functional**: it explains change, never decorates. This is an
operational console — motion is quiet, fast, and rare. Material 3 motion within the existing
Fuse animation utilities (`@fuse/animations`).

## Principles

1. **Purposeful** — animate only to show state change, continuity, or spatial relationship.
2. **Fast** — operators repeat tasks; latency-perception beats flourish.
3. **Subtle** — short distances, low amplitude, no bounce in operational screens.
4. **Respectful** — honor `prefers-reduced-motion` (disable non-essential motion entirely).

## Duration & easing

| Token | Duration | Use |
|-------|----------|-----|
| Instant | 0–50ms | Hover/focus state |
| Short | 100–150ms | Buttons, chips, toggles, tooltips |
| Medium | 200–300ms | Dialogs, drawers, menus, route content fade |
| Long | 300–400ms | Side nav expand/collapse, large surface transitions |

Easing: **standard** `cubic-bezier(0.25, 0.8, 0.25, 1)` (the Fuse drawer easing) for most;
decelerate on enter, accelerate on exit. No spring/overshoot in authenticated screens.

## Where to animate

- **Route content**: brief fade/slide on navigation (medium).
- **Dialogs / drawers / menus**: Material default enter/exit (medium).
- **Real-time updates** (price board, status chip): a **single brief highlight** (~600ms
  fade of a background tint) on the changed cell — then settle. Never reflow or re-sort the
  whole list on one update (BR-PRI-3, BR-ORD-6).
- **Expand/collapse** (nav, table row detail): height/opacity (use `@fuse/animations`
  `expandCollapse`).
- **Loading**: skeleton shimmer (subtle) for tables/cards; `fuse-loading-bar` for route loads.

## Where NOT to animate

- Table sorting/filtering of large sets (instant; animation adds perceived lag).
- KPI numbers on dashboards (no count-up tickers).
- Bulk data refreshes.
- Anything that delays an operator's next action.

## Reduced motion

When `prefers-reduced-motion: reduce`:

- Disable route transitions, highlights, and shimmer; show final state immediately.
- Keep only essential feedback (focus rings, instant state changes).
- Implement via Angular animations' `prefersReducedMotion` / a media-query guard — never ship
  motion that can't be turned off.
