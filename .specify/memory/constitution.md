# FreshFlow Web (FFX) Constitution

**Layer:** Engineering. Subordinate to Business, UX, and Design; authoritative for *how*
the web client is built. Product truth lives in the Business layer
([`specs/product/PRD.md`](../../specs/product/PRD.md) → `UseCase.xlsx`);
visual truth in the Design layer ([`specs/references/README.md`](../../specs/references/README.md)).
All documentation is consolidated under `specs/` (single Spec-Kit source of truth).

## Precedence

When documents disagree, resolve in this order:
**Business → UX → Design → Engineering → AI.** Engineering choices must serve the product
scope and design direction, never redefine them.

## Core Principles

### I. Angular-First, Signal-Driven
Angular 22 standalone components, signal-based reactivity, and the Fuse architecture. No
NgModules for new features. All feature routes are lazy-loaded.

### II. Real-Time by Default
The Restaurant surface reflects live data without manual refresh. Price updates arrive via
SignalR within 500 ms; order, hub, and delivery status push automatically. On
disconnect/reconnect, recover current state via REST — missed events are not replayed.

### III. Type Safety (NON-NEGOTIABLE)
Strict TypeScript. API responses typed to match the backend OpenAPI contract. No `any` in
new code. ESLint + Prettier enforced by pre-commit hooks.

### IV. Test Before Merge
Every change passes lint → Prettier check → unit tests → production build before merge.
Husky runs lint-staged on commit and the test+build gate on push; CI is the final gate.

### V. Bilingual UX
All user-facing text supports Vietnamese and English via Transloco. No hardcoded
user-facing strings in templates — labels, errors, and notifications are translated.

### VI. Performance Budget
Production initial bundle ≤ 5 MB (error) / ≤ 3 MB (warning); per-component styles ≤ 90 KB.
Feature modules stay small via lazy loading. Use Angular Material for consistent,
accessible UI.

## Domain Facts (must hold in the UI)

These follow from the Business layer and constrain implementation:

- **B2B credit/debt, not prepaid checkout.** Orders settle against a restaurant credit
  balance with periodic statements — there is no consumer payment-gateway checkout flow.
- **Self-registration + approval.** Restaurants self-register and start
  `PENDING_APPROVAL`; they cannot order until an Admin approves them.
- **22:00 cutoff.** Order confirmation participates in the next delivery cycle only before
  the configurable daily cutoff.
- **13-module surface.** Build against the canonical module map in the feature map.

## Technology Stack

- **Framework:** Angular 22 (standalone, signals, new control flow)
- **UI:** Angular Material 22 + Fuse Admin Template
- **Styling:** Tailwind CSS 3.x + SCSS via the Fuse theming system
- **State:** Angular Signals + RxJS
- **Real-time:** SignalR client (prices, order/hub/delivery status)
- **i18n:** @ngneat/transloco
- **Testing:** Jasmine + Karma (unit); Playwright (e2e, planned)
- **Tooling:** Node 24, ESLint, Prettier, Husky + lint-staged
- **CI/CD:** GitHub Actions → Docker image (GHCR) → VPS

## Development Workflow

- Branch from `dev`; PR into `main` for releases. Branch names: `{ticket-id}-short-desc`.
- Pre-commit: ESLint + Prettier on staged files. Pre-push: unit tests + production build.
- CI runs the full pipeline on push/PR to `main` and `dev`; CD deploys `dev` on green CI.
- Feature work is spec-driven: no implementation without a spec under `specs/`.

## Governance

This constitution supersedes ad-hoc engineering decisions but never the layers above it.
Conflicts are resolved by the precedence chain. Architecture changes update this file;
product/scope changes update the Business layer first, then cascade down.

**Version:** 1.1 | **Ratified:** 2026-06-21 | **Last Amended:** 2026-06-21
