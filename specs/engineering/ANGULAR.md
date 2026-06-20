# FreshFlow Web — Angular Conventions

**Layer:** Engineering. Extends [`../../.specify/memory/constitution.md`](../../.specify/memory/constitution.md).
Serves Business/UX/Design — never redefines them. Angular **22**, standalone, signals, `inject()`.

## Non-negotiables

- **Standalone components only.** No `NgModule` (anywhere, including for routing).
- **Signals first** for component and view state; `inject()` for DI (no constructor injection).
- **`ChangeDetectionStrategy.OnPush`** on every component.
- **`ViewEncapsulation.None`** (Fuse convention) so Tailwind/theme utilities apply.
- **Tailwind for layout only**; styling via Material + Fuse tokens. **No custom CSS** beyond
  layout utilities (see [`../design/TOKENS.md`](../design/TOKENS.md)).
- **No duplicated UI** — reuse Fuse/Material components first ([`../design/COMPONENTS.md`](../design/COMPONENTS.md)).

## Feature-first structure

Mirror the existing repo convention (`src/app/modules/<feature>/`):

```
src/app/
├── core/            # cross-cutting singletons: auth, navigation, interceptors, guards
├── layout/          # app shell(s) — do not put feature logic here
├── modules/
│   └── <feature>/                      # e.g. orders, pricing, credit, procurement
│       ├── <feature>.routes.ts         # lazy route entry
│       ├── <feature>.component.ts      # smart container (route component)
│       ├── pages/ | components/        # presentational pieces
│       ├── <feature>.service.ts        # signal store + API access for the feature
│       └── <feature>.models.ts         # typed models (or import from generated client)
└── shared/          # only genuinely reused, app-agnostic pieces
```

Map features to the modules in [`../product/PRD.md`](../product/PRD.md) §4. Keep
features self-contained; cross-feature sharing goes through `core/` or `shared/`, never
feature→feature imports.

## Routing

- Lazy-load every feature: `loadChildren: () => import('app/modules/<feature>/<feature>.routes')`
  (matches `src/app/app.routes.ts`).
- Guard authenticated routes with `AuthGuard`; guest routes with `NoAuthGuard`; add RBAC checks
  per [`../product/ROLE_MATRIX.md`](../product/ROLE_MATRIX.md).
- Use the `app/*` path alias (no deep relative imports). Resolve initial data via resolvers
  where a screen needs it before render.

## Components

- Inputs/outputs via signal APIs (`input()`, `output()`, `model()`).
- Derive with `computed()`; side effects only in `effect()` (and sparingly — see
  [`STATE.md`](./STATE.md)).
- Use the new control flow (`@if` / `@for` / `@switch`); `@for` always has `track`.
- Smart/container components own data + signal stores; presentational components take signals
  and emit events. Keep templates declarative.
- Selectors are kebab-case and feature-prefixed; one component per file.

## Internationalization

- All user-facing strings via **Transloco** (vi/en). No literals in templates (Principle V).

## Quality gate

Code must pass `npm run precheck` (lint → Prettier → tests → production build). Pre-commit and
pre-push hooks enforce this; CI is the final gate. Respect production budgets (5 MB initial).

## Avoid

`NgModule` · constructor DI · default change detection · custom CSS / raw hex / raw px ·
duplicated components · feature→feature imports · `any`.
