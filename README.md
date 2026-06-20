# FreshFlow Web (FFX)

Angular web client for **FreshFlow** — a B2B platform that optimizes food procurement and
logistics from Ho Chi Minh City wholesale markets for restaurants. This repo serves the
**Restaurant, Admin, and Operations Manager** surfaces (Market Agent / Hub Staff / Driver
are mobile).

## Documentation

All project documentation is consolidated under **`specs/`** as a single Spec-Kit source of
truth. Layers resolve conflicts **Business → UX → Design → Engineering → AI**.

| Layer | Location |
|-------|----------|
| Business (what) | [specs/product/](specs/product/) — PRD, BUSINESS_RULES, ROLE_MATRIX, UseCase.xlsx |
| UX (flows) | [specs/ux/](specs/ux/) — SITEMAP, NAVIGATION, SCREEN_RULES |
| Design (look) | [specs/design/](specs/design/) + [specs/references/](specs/references/) |
| Engineering (how) | [specs/engineering/](specs/engineering/) + [.specify/memory/constitution.md](.specify/memory/constitution.md) |
| AI (agents) | [specs/ai/](specs/ai/) + [CLAUDE.md](CLAUDE.md) |

Feature specs live alongside as `specs/NNN-<feature>/` (created via the `/speckit-*` skills).

## Tech stack

Angular 22 (standalone + signals) · Angular Material 22 + Fuse · Tailwind CSS 3 · RxJS ·
SignalR (real-time) · Transloco (vi/en) · Jasmine/Karma.

## Prerequisites

- Node **24** (see [.nvmrc](.nvmrc)) and npm

## Getting started

```bash
npm ci          # install exact dependencies
npm start       # dev server at http://localhost:4200
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Dev server (`ng serve`) |
| `npm run build` | Build to `dist/` (production by default) |
| `npm test` | Unit tests (watch) |
| `npm run test:ci` | Unit tests headless, single run, with coverage |
| `npm run lint` | ESLint |
| `npm run precheck` | Full local gate: lint → Prettier → tests → production build |

## Quality gates

Husky enforces quality automatically:

- **pre-commit** → `lint-staged` (ESLint `--fix` + Prettier on staged files)
- **pre-push** → `test:ci` + production build

CI (GitHub Actions) re-runs lint → Prettier → tests → build on every push/PR to `main` and
`dev`. On green CI for `dev`, CD builds a Docker image (GHCR) and deploys to the VPS. Run
`npm run precheck` before pushing to catch failures early.

## Project structure

```
src/
├── @fuse/        # Fuse framework: components, services, Tailwind plugins, theming
├── app/          # Application: layouts, modules (features), core (auth, navigation)
└── styles/       # Global styles and Tailwind entry points
docs/             # Layered project documentation (see above)
specs/            # Spec-Kit feature specs (spec-driven development)
```

## Spec-driven development

Feature work uses [Spec-Kit](https://github.com/github/spec-kit). Skills are installed
under `.claude/skills/`: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement`, with `/speckit-clarify` and `/speckit-analyze` as needed. Project
principles live in the constitution above.
