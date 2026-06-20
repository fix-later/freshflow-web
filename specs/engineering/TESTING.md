# FreshFlow Web — Testing

**Layer:** Engineering. Strategy: **Playwright for end-to-end and component testing**, with the
existing **Jasmine/Karma** suite for fast unit specs during the transition. Every change must
pass the quality gate before merge (Principle IV).

## Test pyramid

| Level | Tool | Scope | Where |
|-------|------|-------|-------|
| Unit | Jasmine + Karma (current) | Pure logic: stores, computeds, mappers, guards, pipes | `*.spec.ts` next to source |
| Component | **Playwright component testing** | A standalone component rendered in isolation, signals + interaction | `*.pw.spec.ts` (proposed) |
| E2E | **Playwright** | Critical user journeys across screens with mocked/staged API + SignalR | `e2e/` (proposed) |

> Playwright is **not yet installed** (`@playwright/test` to add). Until then, unit specs run via
> `npm run test:ci`. Adding Playwright is a reviewed change with its own CI step.

## What to test (by archetype)

- **Stores / state** (unit): filter changes trigger loads; derived signals (`isEmpty`, totals)
  are correct; one-writer rule holds; reconnect triggers re-fetch (not replay).
- **Guards / RBAC** (unit): each role sees only permitted routes/actions
  ([`../product/ROLE_MATRIX.md`](../product/ROLE_MATRIX.md)); `PENDING_APPROVAL` gating.
- **Forms** (component): validation, disabled-until-valid, bilingual error messages, server
  rejection summary.
- **Tables/lists** (component): empty/loading/error states, sort/filter, row→detail navigation.
- **Real-time** (component/e2e): a pushed update highlights the changed cell only and does not
  reflow/re-sort the list.
- **Journeys** (e2e): restaurant places an order before cutoff; admin approves a restaurant;
  operations reviews a route; credit statement → recorded payment reflects in balance.

## Conventions

- **Selectors**: target `data-testid` attributes, not text or CSS classes (resilient to i18n
  and theming). Add `data-testid` to interactive/asserted elements.
- **Determinism**: mock the backend (OpenAPI-typed fixtures) and SignalR events; no live
  network in CI. Freeze time for cutoff/recurring logic.
- **Accessibility**: assert roles/labels and keyboard operability in component tests
  (supports the a11y rules in [`../design/DESIGN.md`](../design/DESIGN.md)).
- **Isolation**: each test sets up its own state; no shared mutable fixtures.

## Coverage & CI

- Unit coverage via `npm run test:ci` (Karma, headless, `--code-coverage`).
- Target meaningful coverage on **stores, guards, mappers, and pricing/credit/order rules**
  (the logic that carries business risk) — not a blanket percentage on templates.
- CI runs lint → Prettier → unit tests → production build today; the Playwright e2e/component
  step is added alongside when the toolchain lands. Run `npm run precheck` locally first.
