# Tasks: Storefront Landing - "Chợ hôm nay có gì?"

**Feature**: `specs/004-storefront-landing/` | **Branch**: `landingpage`
**Input**: [plan.md](./plan.md) · [spec.md](./spec.md) · [data-model.md](./data-model.md) · [contracts/landing-ui-contract.md](./contracts/landing-ui-contract.md) · [research.md](./research.md)

**Tests**: unit tests are generated for the two data seams only (`categoryCounts`, basket
resolution). The spec does not request TDD, and the constitution's gate is
lint → prettier → unit → build rather than per-component tests. Visual verification is handled by
the `/verify` pass, not by Karma.

**Path convention**: all paths are relative to `freshflow-web/`.

---

## Phase 1: Setup

- [ ] T001 Create the section directory `src/app/modules/home/sections/` and confirm `src/app/modules/home/home.routes.ts` still resolves `HomeComponent` unchanged
- [ ] T002 Declare the `home.*` translation namespace by adding the section-heading keys to `public/i18n/vi.json` and `public/i18n/en.json`, keeping both files key-identical and free of em-dash characters

---

## Phase 2: Foundational (blocks every user story)

**Purpose**: the three data seams every section reads from. Nothing below can start until these land.

- [ ] T003 [P] Add `imageUrl` and `description` to the `Market` interface and map them in `_toMarket`/`ensureLoaded`, and extend `_reconcileSelection` to refresh a stored selection when either changes, in `src/app/core/market/market-selection.service.ts`
- [ ] T004 [P] Add `categoryCounts(): Promise<ReadonlyMap<string, number>>` to `src/app/modules/catalog/catalog.service.ts`, counting `categoryId` over the cached base-product list with no new request
- [ ] T005 [P] Create the typed models `MarketZone`, `MarketStrength`, `OrderCutoffView`, `BusinessKind`, `RecommendedBasket`, `BasketLine` in `src/app/modules/home/storefront-landing.types.ts` per data-model.md, with `source: 'stub'` on the three stubbed records
- [ ] T006 Create `src/app/modules/home/storefront-stub.service.ts` exposing `businessKinds()`, `baskets()` and `specialtyFallback()`, with a file-header comment naming the Gap Register entry and every record marked `source: 'stub'`
- [ ] T007 Add `resolveBasket(basket, products)` to the stub service, matching `memberNames` against real catalog products case-insensitively and returning `BasketLine[]` with `product: null` for unmatched names
- [ ] T008 [P] Write `src/app/modules/home/storefront-stub.service.spec.ts` covering: unmatched names resolve to unavailable lines, matched names carry the real product, and matching is case- and accent-tolerant
- [ ] T009 [P] Write the `categoryCounts` cases in `src/app/modules/catalog/catalog.service.spec.ts`: counts group by `categoryId`, an uncategorised product is not counted, and no extra request is issued
- [ ] T010 Rewrite `src/app/modules/home/home.component.ts` as an `OnPush` standalone shell that renders the nine sections in order, replacing all 419 lines of mock data, and add the shared section-shell classes plus the inline Final CTA styles to `home.component.scss`

**Checkpoint**: `/home` renders nine empty section frames, builds clean, and carries no mock data.

---

## Phase 3: User Story 1 - Arrive and buy today's good stock (P1) 🎯 MVP

**Goal**: a buyer with a market selected can add a real listing to their order without leaving the page.

**Independent test**: load `/home` with a featured listing present, add it, confirm the header's order count rises.

- [ ] T011 [US1] Create `src/app/modules/home/sections/today-highlights.component.ts` reading `CatalogService.getFeaturedProducts(marketId)` into a signal, re-fetching when the selected market changes
- [ ] T012 [US1] Build the horizontal scroll-snap rail in `today-highlights.component.html` using `ff-product-card`, wiring `(addedToCart)` to `DraftOrderService.add` and `(favoriteToggled)` to `FavoritesService.toggle`
- [ ] T013 [US1] Add the no-market, loading, and empty states to `today-highlights.component.html`, the empty state routing to `/catalog`
- [ ] T014 [US1] Style the rail in `today-highlights.component.scss`: scroll-snap, `overscroll-behavior: contain`, keyboard-reachable tiles, visible focus ring
- [ ] T015 [P] [US1] Add the `home.today.*` keys to both locale files
- [ ] T016 [US1] Create `src/app/modules/home/sections/market-hero.component.ts` with the search control and the live featured board, reusing the same cached featured read so no second request is made
- [ ] T017 [US1] Build the asymmetric split in `market-hero.component.html`: eyebrow (market name), headline, subtext, search, quick category chips, primary CTA on the left; the real product board on the right
- [ ] T018 [US1] Wire hero search submission to `/catalog` with `?q=` per the navigation contract, and make the empty submission route unfiltered
- [ ] T019 [US1] Seed `searchControl` from `?q=` in `src/app/modules/catalog/catalog.component.ts`, matching how `?category=` is already seeded and kept live through `queryParamMap`
- [ ] T020 [US1] Style the hero in `market-hero.component.scss` within the hero-discipline rules: headline at most 2 lines, subtext at most 20 words, CTA above the fold, `pt-24` cap
- [ ] T021 [P] [US1] Add the `home.hero.*` keys to both locale files

**Checkpoint**: US1 is shippable alone. The page already converts.

---

## Phase 4: User Story 2 - Find the aisle I need (P1)

**Goal**: zones and markets give two more routes into the catalog.

**Independent test**: activate a zone, land in the catalog filtered to it.

- [ ] T022 [US2] Create `src/app/modules/home/sections/market-zones.component.ts` joining `categoryTree()` with `categoryCounts()`, dropping zero-count zones and ordering by count descending
- [ ] T023 [US2] Build the signage bento in `market-zones.component.html` with mixed tile sizes, real `imageUrl` when present and a marker fallback when not, each tile routing to `/catalog?category={id}`
- [ ] T024 [US2] Style the bento in `market-zones.component.scss` with an exact cell count and no empty cells, collapsing to one column on narrow viewports
- [ ] T025 [P] [US2] Add the `home.zones.*` keys to both locale files
- [ ] T026 [US2] Create `src/app/modules/home/sections/market-specialties.component.ts` reading `MarketSelectionService.markets()`, calling `ensureLoaded()`, and marking the selected market
- [ ] T027 [US2] Build the editorial two-column layout in `market-specialties.component.html`, showing `description` as the speciality only when non-empty and omitting the line otherwise
- [ ] T028 [US2] Wire the market CTA to `MarketSelectionService.select()` then `/catalog`, so choosing a market re-scopes the whole page
- [ ] T029 [US2] Style `market-specialties.component.scss` with the image fallback tile and the selected-market treatment
- [ ] T030 [P] [US2] Add the `home.markets.*` keys to both locale files

**Checkpoint**: three distinct routes into the catalog exist (SC-006).

---

## Phase 5: User Story 3 - Order everything my kitchen needs tomorrow (P2)

**Goal**: a buyer adds a whole editable basket in one action.

**Independent test**: exclude a line, change a quantity, add, confirm the draft order matches.

- [ ] T031 [US3] Create `src/app/modules/home/sections/recommended-basket.component.ts` holding the selected basket, resolving its lines against the selected market's products, and exposing per-line `included` and `quantity` signals
- [ ] T032 [US3] Build the basket panel in `recommended-basket.component.html`: selector rail of baskets on one side, editable line items on the other, each line showing the real price or an unavailable marker
- [ ] T033 [US3] Implement the keyboard-operable quantity stepper, clamped to at least `minimumOrderQuantity`, with `aria-label` per line
- [ ] T034 [US3] Implement the add-all action, adding only lines that are both `included` and `available`, and disabling the action when none qualify
- [ ] T035 [US3] Add the empty and no-market states, including the case where every line of a basket is unavailable at this market
- [ ] T036 [US3] Style `recommended-basket.component.scss` as a panel, not a card grid, with the line list collapsing to one column on narrow viewports
- [ ] T037 [P] [US3] Add the `home.basket.*` keys to both locale files
- [ ] T038 [US3] Create `src/app/modules/home/sections/tomorrow-menu.component.ts` and its scroll-snap pill chips, emitting the chosen business kind
- [ ] T039 [US3] Mediate the tomorrow-menu to basket selection through a signal on the shell, and scroll the basket section into view on selection while honouring reduced motion
- [ ] T040 [P] [US3] Add the `home.tomorrow.*` keys to both locale files

**Checkpoint**: order value lever is live.

---

## Phase 6: User Story 4 - Order before the market closes (P2)

**Goal**: a true countdown to a real deadline.

**Independent test**: with a known cut-off, the remaining time counts down and the delivery day is right on both sides of it.

- [ ] T041 [US4] Create `src/app/modules/home/sections/order-cutoff.component.ts` reading `OrdersService.getOrderingWindow()` into an `OrderCutoffView`
- [ ] T042 [US4] Implement the one-second tick with clamped remaining time, cleared on destroy, and rendered statically under `prefers-reduced-motion`
- [ ] T043 [US4] Render no timer at all when the window is unknown, and the next delivery cycle when the cut-off has passed
- [ ] T044 [US4] Build and style the full-width band in `order-cutoff.component.html`/`.scss`, carrying the second and final permitted eyebrow
- [ ] T045 [P] [US4] Add the `home.cutoff.*` keys to both locale files

---

## Phase 7: User Story 5 - Understand what happens after I order (P3)

**Goal**: the real operational sequence, legible at both viewports.

- [ ] T046 [US5] Create `src/app/modules/home/sections/freshflow-process.component.ts` with the five real operational steps as typed data
- [ ] T047 [US5] Build the timeline in `freshflow-process.component.html`/`.scss`, horizontal on wide viewports and vertical on narrow ones, with the connector drawn by CSS rather than a hand-rolled SVG
- [ ] T048 [P] [US5] Add the `home.process.*` keys to both locale files
- [ ] T049 [US5] Add the inline Final CTA band to `home.component.html` and its `home.finalCta.*` keys to both locale files

---

## Phase 8: Polish & Cross-Cutting

- [ ] T050 Add the `data-testid` hooks from the UI contract to all nine section roots and the listed inner elements
- [ ] T051 Verify locale parity and the zero-dash rule with the two commands in [quickstart.md](./quickstart.md); fix any drift
- [ ] T052 Audit the anti-slop budget across the finished page: at most 3 eyebrows, 9 distinct layout families, one accent, one radius system, no banned patterns
- [ ] T053 Confirm every animated element degrades under `prefers-reduced-motion` and that no `window.addEventListener('scroll')` was introduced
- [ ] T054 Delete the dead mock interfaces (`Product`, `Promo`, `BlogPost`, `Feature`) and any now-unused imports left over from the old page
- [ ] T055 Run `/verify`: build, serve on port 4299, and screenshot every section at 1440px and 375px
- [ ] T056 Run `/ponytail-review` and `/caveman-review` on the final diff and apply the findings
- [ ] T057 Run `npm run precheck` and get it green without bypassing any hook

---

## Dependencies

```
Phase 1 (T001-T002)
   │
Phase 2 Foundational (T003-T010)   ← blocks everything
   │
   ├── Phase 3  US1 (T011-T021)    ← MVP, ship-alone capable
   ├── Phase 4  US2 (T022-T030)    ← independent of US1
   ├── Phase 5  US3 (T031-T040)    ← needs T006/T007 only
   ├── Phase 6  US4 (T041-T045)    ← fully independent
   └── Phase 7  US5 (T046-T049)    ← fully independent
                  │
            Phase 8 Polish (T050-T057)
```

**Story independence**: US1 through US5 touch disjoint component files and can be built in any
order once Phase 2 lands. The single cross-story coupling (T039, tomorrow-menu selecting a basket)
lives inside US3.

**One ordering constraint worth noting**: T019 edits `catalog.component.ts`, which is outside the
home module. It belongs to US1 because the hero search is worthless without it, but it is the only
task in this feature that touches another feature's component.

## Parallel opportunities

- **Phase 2**: T003, T004, T005 are three different files with no shared dependency. T008 and T009 likewise.
- **Every story phase**: the `[P]` translation tasks (T015, T021, T025, T030, T037, T040, T045, T048) touch only the locale files and can be batched into one pass at the end of each phase.
- **Phases 3 through 7** can proceed fully in parallel across five workers after the Phase 2 checkpoint.

## Implementation strategy

**MVP = Phase 1 + Phase 2 + Phase 3.** That delivers a landing where a buyer can see today's real
stock and add it to an order, which is the whole conversion argument. Phases 4 through 7 each add
a distinct discovery or trust lever and can ship incrementally behind no flag, since each is a
self-contained section of the page.

**Total: 57 tasks** across 8 phases. US1 21 · US2 9 · US3 10 · US4 5 · US5 4 · shared 8.
