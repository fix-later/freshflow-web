# FreshFlow Web — AI Review Checklist

**Layer:** AI. Run this before proposing a change as done. A "no" on any **must** item blocks
merge. Ordered by the precedence chain (Business → … → Engineering).

## Business

- [ ] Behavior matches [`../product/BUSINESS_RULES.md`](../product/BUSINESS_RULES.md) and
      [`../product/PRD.md`](../product/PRD.md); no invented logic.
- [ ] Respects resolved conflicts: **credit/debt (no gateway checkout)**, **self-registration +
      approval**, **no SMS/email**.
- [ ] RBAC correct per [`../product/ROLE_MATRIX.md`](../product/ROLE_MATRIX.md): actions hidden
      for unauthorized roles **and** server `403` handled; ownership scoping (`R⁺`) applied.
- [ ] Approval gate enforced for `PENDING_APPROVAL` restaurants.

## UX

- [ ] Routes/IA match [`../ux/SITEMAP.md`](../ux/SITEMAP.md) (≤ 3 levels); nav role-filtered.
- [ ] All required states present: **loading, empty, error, permission**, and **stale/reconnect**
      for real-time screens.
- [ ] One primary action per screen; destructive actions confirmed (with reason where required).

## Design

- [ ] Material 3 / Google-Workspace feel: low elevation (0–1), dense tables, large whitespace,
      content-first.
- [ ] Color/type/spacing use **tokens** ([`../design/TOKENS.md`](../design/TOKENS.md)); no raw
      hex/px; readable in light **and** dark.
- [ ] Reuses Fuse/Material components; no duplicated UI; status never by color alone.
- [ ] Motion is functional and respects `prefers-reduced-motion`
      ([`../design/MOTION.md`](../design/MOTION.md)).

## Engineering

- [ ] Standalone + signals + `inject()` + **OnPush** + `ViewEncapsulation.None`; **no NgModule**.
- [ ] Feature-first folder; lazy route; `app/*` alias; no feature→feature imports.
- [ ] **Tailwind layout only**; **no custom CSS**.
- [ ] Signals-first state, narrowest scope; private signals exposed as `computed`/readonly;
      effects side-effect-only ([`../engineering/STATE.md`](../engineering/STATE.md)).
- [ ] API via generated types + feature service + interceptors; **no invented endpoints**;
      components don't call `HttpClient` directly ([`../engineering/API.md`](../engineering/API.md)).
- [ ] Real-time via the SignalR manager; re-fetch on reconnect (no replay).
- [ ] All user-facing strings via Transloco (vi/en); no `any`.
- [ ] `data-testid` on interactive/asserted elements; relevant tests added/updated.

## Gate

- [ ] `npm run precheck` passes (lint → Prettier → tests → production build); hooks not bypassed.
- [ ] Production budgets respected; change scoped; no stray dependencies.
