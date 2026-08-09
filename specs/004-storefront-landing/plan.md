# Implementation Plan: Storefront Landing - "Chợ hôm nay có gì?"

**Branch**: `landingpage` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-storefront-landing/spec.md`

## Summary

Replace the mock brochure at `/home` with a market-scoped shopping surface built from nine
sections. Everything sellable on the page is real: listings, prices, units and stock come from
the selected market through `CatalogService`; adding to an order goes through the existing
`DraftOrderService`; the order deadline comes from the existing ordering-window endpoint.
The three concepts with no backend (recommended baskets, market specialities, business kinds)
are isolated behind one typed stub service so a future endpoint replaces the data source without
touching a single component.

Design direction is declared before code per `design-taste-frontend`:
`DESIGN_VARIANCE 7 / MOTION_INTENSITY 4 / VISUAL_DENSITY 6`, light-locked theme, navy `#313F90`
as the only accent, one radius system, nine distinct layout families.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (strict, `noImplicitAny`), Angular 22.0.0

**Primary Dependencies**: Angular Material 22 (M3 tokens), Fuse template, Tailwind CSS 3.4,
`@jsverse/transloco` 8.4. **No new dependencies are added by this feature.**

**Storage**: None of its own. Draft order state is server-persisted through `DraftOrderService`;
market selection is in `localStorage` via `MarketSelectionService`.

**Testing**: Jasmine + Karma unit tests (`npm run test:ci`). Playwright for the `/verify` pass.

**Target Platform**: Evergreen desktop and mobile browsers.

**Project Type**: Web client (Angular SPA) against an existing ASP.NET Core modular monolith.

**Performance Goals**: Landing shows its first real listing within one round trip of the market
listing endpoint. Featured listings arrive in a **single** request because the backend pins every
featured row to page 1. Category counts cost **zero** extra requests (derived from the base-product
list `CatalogService` already caches per session).

**Constraints**: Per-component styles < 90 KB (hard build error at that ceiling, `angular.json:55`).
Initial bundle warning at 3 MB. No `any`. No hardcoded user-facing strings. Route path `/home`
must not change.

**Scale/Scope**: One route, 9 sections, 8 new section components + 1 inline section, 1 new
service (stub data only), 2 extensions to existing services, ~60 new translation keys per language.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design.*

| Principle | Gate | Verdict |
|---|---|---|
| I. Angular-First, Signal-Driven | Standalone components, signals, lazy route, no NgModules | **PASS** - all 8 section components standalone + `OnPush`; state in signals; `/home` stays lazy via `home.routes.ts`. Note the current `home.component.ts` uses `ChangeDetectionStrategy.Eager`; the rewrite moves it to `OnPush`, which brings it *into* compliance. |
| II. Real-Time by Default | Live price via SignalR | **N/A with note** - the landing shows a snapshot, not a live board. It is an entry surface; the live price board is the catalog's job. Not a violation, but recorded so it is a deliberate choice. |
| III. Type Safety | No `any`, typed to the OpenAPI contract | **PASS** - stub models are declared interfaces; API reads go through the existing tolerant envelope helpers, which are typed. |
| IV. Test Before Merge | lint → prettier → unit → build | **PASS** - `npm run precheck` is the exit gate; new unit tests cover the two new services. |
| V. Bilingual UX | No hardcoded user-facing strings | **PASS** - every string is a Transloco key in both `vi.json` and `en.json`. This is the single largest correction to the current page, which has zero keys. |
| VI. Performance Budget | ≤ 90 KB per component style | **PASS by construction** - splitting into 8 components means each stylesheet is budgeted separately; today's single 15.2 KB `home.component.scss` is replaced by ~8 files well under the ceiling. |

**Domain facts honoured**: no prepaid checkout (all CTAs lead to the credit-terms draft-order
flow); ordering respects the configurable daily cutoff read from the server rather than the
hardcoded 22:00 in the constitution's prose; the page is readable by guests, who are gated at
order time by the existing approval rules, not by hiding the storefront.

**No complexity violations.** The Complexity Tracking table is therefore omitted.

## Ponytail Pass (intensity: lite)

Applied to the component split, since that is where this feature could most easily over-build:

| Candidate | Decision | Reason |
|---|---|---|
| 9 section components (as listed in the request) | **8 built, 1 inlined** | `FinalCta` is a headline plus one button. Giving it a `.ts`/`.html`/`.scss` trio is ceremony, not structure. It is inlined into the shell template. The other 8 each own state, data, or > 30 lines of style, so they earn a file. |
| A `LandingService` facade over CatalogService | **Rejected** | Speculative indirection. Sections inject `CatalogService` directly. |
| A generic `SectionShellComponent` | **Rejected** | Three shared class names in the shell stylesheet do the same job with no API to maintain. |
| Separate services for baskets / specialities / business kinds | **Rejected, merged into one** | All three are the same thing: front-end stub data awaiting one endpoint. One `StorefrontStubService` with three typed readers. |
| New count endpoint for zone item counts | **Rejected** | `CatalogService` already caches the full base-product list for the session. Counting categories from it costs zero requests. Exposing one method beats adding an API call. |
| A new `OrderWindowService` for the cut-off | **Rejected, reuse instead** | Verification found `OrdersService.getOrderingWindow()` already exists (`orders.service.ts:224`), already reads the endpoint tolerantly, and already returns `{ isOpen, cutoffTime, earliestServiceDate, deliveryWindowDays }`. Writing a second service would have duplicated a solved problem. The landing injects the existing one. |

## Design Decisions (locked before implementation)

**Layout families** - one per section, so no two sections repeat (spec FR-004):

| # | Section | Layout family |
|---|---|---|
| 1 | Hero | Asymmetric split: copy + search left, live market board right |
| 2 | Hàng đẹp hôm nay | Horizontal scroll-snap rail of product tiles |
| 3 | Đi một vòng quanh chợ | Signage bento, mixed tile sizes |
| 4 | Mỗi chợ một thế mạnh | Editorial 2-column with photography |
| 5 | Mọi người thường mua | Basket panel: selector rail + editable line items |
| 6 | Mai bán gì? | Scroll-snap pill chips |
| 7 | Cut-off | Full-width band with countdown |
| 8 | Freshflow đi chợ thế nào? | Timeline (horizontal desktop, vertical mobile) |
| 9 | Final CTA | Full-bleed closing band |

**Anti-slop budget** enforced from `design-taste-frontend` §9 and §14:

- **Eyebrows: 2 of a permitted 3** (`ceil(9/3)`). Spent on the hero market name and the cut-off band. No section-number eyebrows.
- **Em-dashes: zero.** Applies to every translation value in both locales, checked mechanically before ship.
- **Accent lock**: navy `#313F90` for every CTA and active state, page-wide. Mint `#50F0A3` is decorative only; `TOKENS.md:20` records it at 1.47:1 contrast, so it never sits behind text.
- **Shape lock**: cards `1rem`, interactive controls full-pill, inputs `0.75rem`.
- **Theme lock**: one light-locked composition using Fuse semantic tokens, so dark mode follows without any section inverting.
- **Banned outright here**: fake screenshots built from `div`s, hand-rolled decorative SVG, scroll cues, decorative status dots, locale/weather strips, version stamps, `border-t` + `border-b` on every row, three equal feature cards.
- **Motion at 4** means CSS transitions and staggered entrance only. No scroll hijack, no `window.addEventListener('scroll')`, everything behind `prefers-reduced-motion`.

**Imagery**: no image-generation tool exists in this environment and a placeholder image service has
no place in a production storefront, so **every image is real API data** - category `imageUrl`,
market `imageUrl`, product `thumbnail`. Where a record has no image, the tile falls back to a
token-tinted marker so the row keeps one rhythm.

## Data Sources

| Section needs | Source | Status |
|---|---|---|
| Today's featured listings | `CatalogService.getFeaturedProducts(marketId)` | **Real**, 1 request |
| Category tree, names, artwork | `CatalogService.getCategories()` | **Real**, cached |
| Items per category | New `CatalogService.categoryCounts()` over the cached base-product list | **Real**, 0 extra requests |
| Market name, address, artwork, description | `MarketSelectionService.markets()`, extended to carry `imageUrl` + `description` | **Real** (extension needed) |
| Add to order | `DraftOrderService.add(product, quantity)` | **Real** |
| Favourites | `FavoritesService.toggle(product)` | **Real** |
| Search submit | Router to `/catalog` | **Real** |
| Daily cut-off + delivery window | Existing `OrdersService.getOrderingWindow()` | **Real**, already built |
| Basket contents | `StorefrontStubService` | **STUB** |
| Market speciality | Market `description` when present, else `StorefrontStubService` | **Partly real** |
| Business kinds | `StorefrontStubService` | **STUB** |

## Gap Register (surfaced, not invented)

These are the places where the request asked for something the system cannot supply. None of them
were resolved by inventing business logic.

1. **`#131F90` does not exist in this repository.** Zero occurrences across web and backend. The
   brand navy recorded in `specs/design/TOKENS.md:12`, `tailwind.config.js:33` and
   `src/@fuse/styles/themes.scss:31` is **`#313F90`**. Treated as a typo in the request and the
   repo token is used, per the Business → UX → **Design** → Engineering → AI precedence chain.
   **Confirm this.**
2. **Recommended baskets have no backend.** No endpoint, table, model or migration anywhere. The
   shipped sets are illustrative placeholders behind `StorefrontStubService`, marked in code.
   **Product must confirm the real basket definitions before launch.**
3. **Business kinds have no backend.** Same treatment. The ingredient counts shown are properties
   of the stub, not measured facts.
4. **Market speciality has no field.** The closest real data is the market's free-text
   `description`. Used when present; otherwise the speciality line is omitted rather than invented.
5. **Per-market item counts are not obtainable cheaply.** The market listing endpoint is
   cursor-paginated with no total. Market cards therefore show location and speciality, not a
   count. Zone counts, which *are* derivable for free, are catalog-wide rather than market-scoped;
   the label is worded accordingly.
6. **No `home` translation keys exist today** (0 of 1912). The current page is entirely
   hardcoded Vietnamese, so this feature adds the whole namespace rather than editing one.
7. **The cut-off is sent as a bare wall-clock time, not a zoned instant.** The countdown
   resolves `22:00` against the *browser's* zone. Correct for buyers in Vietnam, which is all of
   them today, but a buyer browsing from another zone sees the countdown offset. The fix belongs
   on the server (send an instant or the zone); hardcoding `+07:00` in the client would be
   inventing a rule the API does not state.
8. **The market listing endpoint reports `Description` but nothing in the web client reads it.**
   This feature is the first consumer. If markets are not currently given descriptions by
   operators, the speciality line will simply be absent until they are. **Worth checking with
   whoever administers the market records.**

## Project Structure

### Documentation (this feature)

```text
specs/004-storefront-landing/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── landing-ui-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
freshflow-web/
├── public/i18n/
│   ├── vi.json                                  # + ~60 home.* keys
│   └── en.json                                  # + ~60 home.* keys
└── src/app/
    ├── core/
    │   └── market/market-selection.service.ts   # EXTEND: imageUrl + description
    ├── modules/
    │   ├── catalog/catalog.service.ts           # EXTEND: categoryCounts()
    │   ├── orders/orders.service.ts             # REUSED unchanged (getOrderingWindow)
    │   └── home/
    │       ├── home.routes.ts                   # unchanged
    │       ├── home.component.ts|html|scss      # REWRITTEN shell + inline final CTA
    │       ├── storefront-stub.service.ts       # NEW: baskets, specialities, kinds
    │       ├── storefront-landing.types.ts      # NEW: typed models
    │       ├── storefront-stub.service.spec.ts  # NEW
    │       └── sections/
    │           ├── market-hero.component.ts|html|scss
    │           ├── today-highlights.component.ts|html|scss
    │           ├── market-zones.component.ts|html|scss
    │           ├── market-specialties.component.ts|html|scss
    │           ├── recommended-basket.component.ts|html|scss
    │           ├── tomorrow-menu.component.ts|html|scss
    │           ├── order-cutoff.component.ts|html|scss
    │           └── freshflow-process.component.ts|html|scss
    └── shared/product-card/                     # REUSED unchanged
```

**Structure Decision**: sections live under `src/app/modules/home/sections/`, matching how
`src/app/modules/catalog/pages/` already nests its sub-surfaces. Shared building blocks stay
where they are and are consumed unchanged; nothing under `src/app/shared/` or
`src/app/layout/common/` is modified except the two documented service extensions.
