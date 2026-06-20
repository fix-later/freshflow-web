# FreshFlow Web — AI Generation Rules

**Layer:** AI (lowest precedence). Guidance for agents generating code in this repo. Never
override the layers above. Conflicts resolve **Business → UX → Design → Engineering → AI**.
See also [`../../CLAUDE.md`](../../CLAUDE.md).

## Read before generating

Load the task-scoped context per [`CONTEXT.md`](./CONTEXT.md) (canonical read order +
precedence). At minimum: the module in [`../product/PRD.md`](../product/PRD.md) §4, its rules in
[`../product/BUSINESS_RULES.md`](../product/BUSINESS_RULES.md), permissions in
[`../product/ROLE_MATRIX.md`](../product/ROLE_MATRIX.md), the UX archetype, the design tokens,
the relevant engineering doc, and existing repo conventions (`src/app/modules/*`, `core/`,
`layout/`, `app.routes.ts`).

## Hard constraints

- **Do not invent business logic.** Use only rules in the product docs / `UseCase.xlsx`.
- **Do not invent APIs.** Endpoints/schemas come from the backend OpenAPI; generate types, don't
  fabricate them ([`../engineering/API.md`](../engineering/API.md)).
- **Do not create visual assets** or copy the reference images; extract layout/spacing/hierarchy
  only.
- **Honor resolved conflicts**: B2B credit/debt (no gateway checkout), self-registration +
  approval, 13-module taxonomy, in-app/SignalR/push (no SMS/email).

## How to generate

- **Reuse first** — Fuse + Angular Material components before anything new
  ([`../design/COMPONENTS.md`](../design/COMPONENTS.md)); don't duplicate UI.
- **Match conventions** — standalone, signals, `inject()`, OnPush, `ViewEncapsulation.None`,
  feature-first folders, lazy routes, `app/*` alias ([`../engineering/ANGULAR.md`](../engineering/ANGULAR.md)).
- **Tailwind for layout only**; color/type/elevation via tokens
  ([`../design/TOKENS.md`](../design/TOKENS.md)); **no custom CSS**, no raw hex/px.
- **Signals first** for state; RxJS only at stream edges ([`../engineering/STATE.md`](../engineering/STATE.md)).
- **i18n** every user-facing string via Transloco (vi/en).
- **Add `data-testid`** to interactive/asserted elements ([`../engineering/TESTING.md`](../engineering/TESTING.md)).

## Definition of done

- Implements the relevant spec under `specs/` (feature work is spec-driven).
- Passes `npm run precheck` (lint → Prettier → tests → production build); hooks not bypassed.
- Passes the [`REVIEW.md`](./REVIEW.md) checklist.
- Scoped to one feature; no unrelated edits; no new dependencies without calling them out.

## When unsure

State the assumption and ask, or leave a `TODO` referencing the doc that should answer it —
**never** silently invent product behavior, endpoints, or tokens.
