# FreshFlow Web — Context Loading

**Layer:** AI. The single guide to **what context to load, in what order, for a given task** —
so agents stay grounded without re-reading everything. Pairs with
[`GENERATION.md`](./GENERATION.md) (how to build) and [`REVIEW.md`](./REVIEW.md) (how to check).

## Precedence (always)

> Resolve conflicts **Business → UX → Design → Engineering → AI.** If a request contradicts a
> higher layer, flag it instead of complying.

## Canonical sources (load in this order)

| Layer | Load | For |
|-------|------|-----|
| Business | [`../product/PRD.md`](../product/PRD.md) → [`../product/UseCase.xlsx`](../product/UseCase.xlsx) | Scope, actors, modules, resolved conflicts (RC-*) |
| Business | [`../product/BUSINESS_RULES.md`](../product/BUSINESS_RULES.md) · [`../product/ROLE_MATRIX.md`](../product/ROLE_MATRIX.md) | Invariants (BR-*) and permissions |
| UX | [`../ux/SITEMAP.md`](../ux/SITEMAP.md) · [`../ux/NAVIGATION.md`](../ux/NAVIGATION.md) · [`../ux/SCREEN_RULES.md`](../ux/SCREEN_RULES.md) | IA, navigation, screen archetypes & states |
| Design | [`../design/`](../design/) (DESIGN, MATERIAL3, TOKENS, COMPONENTS, MOTION) + [`../references/README.md`](../references/README.md) | Look-and-feel, tokens, component choices |
| Engineering | [`../engineering/`](../engineering/) (ANGULAR, API, STATE, TESTING) + [`../../.specify/memory/constitution.md`](../../.specify/memory/constitution.md) | How to build |
| Repo | `src/app/modules/*`, `core/`, `layout/`, `app.routes.ts` | Existing conventions to reuse |

## Task-scoped loading

Don't load everything — load the **slice** the task touches:

1. Identify the **module** (M1–M13) from [`../product/PRD.md`](../product/PRD.md) §4.
2. Load that module's **rules** (BR-* in `BUSINESS_RULES.md`) and **permissions**
   (`ROLE_MATRIX.md`).
3. Load the **screen archetype** for the surface (`ux/SCREEN_RULES.md`) + nav/IA entry.
4. Load **design tokens/components** only for the UI you build.
5. Load the **engineering** doc relevant to the change (e.g., `STATE.md` for a store, `API.md`
   for data access).
6. Open the matching **feature spec** under `specs/NNN-*` if one exists.

## A good task brief includes

1. **Goal** in product terms (e.g., "restaurant cancels a CONFIRMED order before batching, with
   a reason").
2. **Module + rules** — the module code and the specific BR-*, role rights, and screen archetype.
3. **Scope** — exactly which feature/files; what is out of scope.
4. **Constraints** — standalone/signals/OnPush, Tailwind-layout-only, tokens, i18n, **no invented
   APIs/logic**.
5. **Done** — passes `npm run precheck` and [`REVIEW.md`](./REVIEW.md).

**Weak:** "Build the orders page."
**Good:** "Implement `/orders` (M5) for `restaurant` per `ux/SCREEN_RULES.md` (list/table) and
`BUSINESS_RULES.md` BR-ORD-*. Dense `mat-table`, real-time status chip, filters in the orders
signal store. Use generated API types — do not invent endpoints. Scope: `src/app/modules/orders/`
only. Done = precheck + REVIEW.md."

## Don't

- Don't load or paste the reference PNGs to reproduce them — extract layout/spacing/hierarchy only.
- Don't pull business logic into the prompt — point to the doc and let the agent read it.
- Don't proceed past a gap (missing endpoint/unclear rule) — surface it.

## Spec-driven flow

New features use the Spec-Kit skills with these docs + the constitution as standing context:
`/speckit-specify` → `/speckit-clarify` (if needed) → `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement`.
