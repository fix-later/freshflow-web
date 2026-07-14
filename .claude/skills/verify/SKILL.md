---
name: verify
description: Build, launch, and drive FreshFlow Web (Angular + Fuse) to verify changes at the running app. Use when verifying a diff end-to-end instead of just precheck.
---

# Verifying FreshFlow Web at runtime

## Build & launch

- `npm start -- --port 4299` — port 4200 is usually taken by the dev's own
  `ng serve`. Compile takes ~30–60s; watch the output for "Building..." →
  bundle table.
- `npm run precheck` = lint → prettier --check → karma tests → prod build.
  It is CI, not verification.

## Drive (Playwright, no project deps)

- `npm i playwright-core --prefix <scratchpad> --no-save`, then
  `chromium.launch({ channel: 'chrome', headless: true })` — system Chrome
  works, no browser download.
- **Auth**: all main routes sit behind `AuthGuard`, which always fetches
  `GET /api/v1/profile/me` from the backend origin configured in
  `src/environments/environment.*.ts` (`apiBaseUrl`; default
  `http://localhost:8080`, overridable via `environment.local.ts`). To get
  past it offline:
  1. Stub routes with Playwright. **Playwright matches routes in reverse
     registration order — register the catch-all FIRST**, then specifics:
     - catch-all `**/api/v1/**` → 404
     - `**/api/v1/profile/me` → `{ data: { id, email, role: 'admin', fullName } }`
       (role `admin` skips the restaurant approval-status fetch)
  2. Forge a JWT (any signature; only `exp` is decoded):
     `localStorage.setItem('accessToken', '<b64url-header>.<b64url-{exp:future}>.sig')`
     plus any `refreshToken`, then goto `/home`.
- Navigation/messages/notifications resolve from the in-app Fuse mock API —
  no network stubs needed for them.

## Useful selectors / flows

- Sign-in error alert (+shake): `/sign-in`, fill `#identifier` + `#password`,
  click `role=button[name=/sign in/i]` with login stubbed to 401.
- Search overlay: `search button` (bar appearance) opens; `Escape` closes.
- Settings drawer: `.settings-cog` (a div, not a button); its overlay is
  `.fuse-drawer-overlay`; clicking the overlay closes and removes it.
- Mobile nav: viewport < 600px, hamburger is
  `button:has(mat-icon[data-mat-icon-name="bars-3"])`; overlay is
  `.fuse-vertical-navigation-overlay`. To close by clicking the overlay,
  click near the right edge (`position: {x: 460, y: 450}` at 500px width) —
  the nav panel covers the element's center point.
- Animations: sample `document.getAnimations().map(a => a.animationName || 'WAAPI')`
  on an interval started *before* triggering; CSS classes are
  `fuse-animate-*` (see `src/@fuse/styles/animations.scss`), imperative ones
  show as WAAPI.
