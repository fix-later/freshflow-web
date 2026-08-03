<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/003-restaurant-onboarding-wizard/plan.md`
<!-- SPECKIT END -->

# FreshFlow Web — Agent Guide

**Layer:** AI (lowest precedence). Never override the layers below your guidance.
When anything conflicts, resolve in this order:
**Business → UX → Design → Engineering → AI.**

All project documentation is a **single Spec-Kit source of truth under `specs/`**. There is no
separate `docs/` tree. Load context per [`specs/ai/CONTEXT.md`](specs/ai/CONTEXT.md).

## Authoritative sources (under `specs/`)

| Need | Source |
|------|--------|
| What the product does (scope, roles, modules, resolved conflicts RC-*) | [specs/product/PRD.md](specs/product/PRD.md) → [UseCase.xlsx](specs/product/UseCase.xlsx) |
| Business rules & permissions | [specs/product/BUSINESS_RULES.md](specs/product/BUSINESS_RULES.md) · [specs/product/ROLE_MATRIX.md](specs/product/ROLE_MATRIX.md) |
| Screens, navigation, IA | [specs/ux/](specs/ux/) |
| Visual direction, tokens, components | [specs/design/](specs/design/) · [specs/references/README.md](specs/references/README.md) |
| How to build (principles, stack, workflow) | [specs/engineering/](specs/engineering/) · [.specify/memory/constitution.md](.specify/memory/constitution.md) |
| AI rules (context / generation / review) | [specs/ai/CONTEXT.md](specs/ai/CONTEXT.md) · [GENERATION.md](specs/ai/GENERATION.md) · [REVIEW.md](specs/ai/REVIEW.md) |

## Working rules

- **Follow the specs; don't restate them.** Design rules live in `specs/design/` +
  `specs/references/` (extract layout/spacing/patterns from the `*.png`; never clone or lift
  exact colors/assets). Engineering rules live in `specs/engineering/` + the constitution.
- **Honor the resolved business decisions** (PRD § Resolved Conflicts): B2B credit/debt — not
  prepaid checkout; self-registration with Admin approval; 13-module taxonomy; in-app + SignalR
  + push (no SMS/email).
- **Don't invent** business logic, APIs, thresholds, or visuals — surface gaps instead.
- **Verify before done:** changes must pass `npm run precheck` (lint → Prettier → tests →
  production build). Pre-commit/pre-push hooks enforce this; don't bypass them.
- **Bilingual (vi/en) via Transloco; strict TypeScript, no `any`.**
- Feature work is spec-driven — use the `/speckit-*` skills; a feature spec lives at
  `specs/NNN-<feature>/` and must exist before implementation.
