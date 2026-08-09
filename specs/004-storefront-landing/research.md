# Phase 0 Research: Storefront Landing

Every unknown in the Technical Context was resolved by reading the code rather than assuming.
Each entry records what was chosen, why, and what was rejected.

---

## R1. How does the landing get "today's good stock" in one request?

**Decision**: `CatalogService.getFeaturedProducts(marketId)`, which reads page 1 of the market
listing and keeps the pinned rows.

**Rationale**: `MarketProductReader.GetPageAsync` (backend, `Pricing.Infrastructure/CrossModule/`)
pins **every** `IsFeatured` row to the top of page 1 regardless of page size, then streams the
unpinned rows by keyset cursor. So one small request returns the complete featured set. The
service already caches per market and deliberately does not cache an empty result, because a
guest 401 is indistinguishable from "nothing pinned".

**Alternatives rejected**:
- *A dedicated `/markets/{id}/featured` endpoint.* Would be cleaner, but requires backend work for
  data already obtainable in one call.
- *Walking every page and filtering client-side.* Wasteful; page 1 is provably complete.

---

## R2. Where does the order cut-off come from?

**Decision**: the existing `OrdersService.getOrderingWindow()` (`orders.service.ts:224`).

**Rationale**: The endpoint `GET /api/v1/orders/ordering-window` exists
(`OrdersController.cs:70`) and returns `OrderingWindowResponse(TimeOnly DailyCutoffTime,
int DeliveryWindowDays)`. The web client already wraps it in a tolerant reader that returns
`{ isOpen, cutoffTime, earliestServiceDate, deliveryWindowDays }`, coping with the several
spellings the backend has used. Writing a second reader would duplicate solved work.

**Alternatives rejected**:
- *A new `OrderWindowService`.* Rejected on discovery of the existing one. This was in the plan
  until verification; recording the reversal here so the reasoning is not lost.
- *Hardcoding 22:00.* The constitution names 22:00 but also calls it configurable, and
  `OrderCutoffScheduler.cs:12` treats it as a default rather than a constant. Hardcoding would
  make the page lie whenever an operator changes it.

**Consequence for the UI**: when the call fails, the section shows no countdown at all rather
than a fallback time. A wrong deadline is worse than no deadline on a page whose whole point is
telling you when to order.

---

## R3. Can zone item counts be real without extra requests?

**Decision**: yes. Expose a `categoryCounts()` reader on `CatalogService` derived from the
base-product list it already caches.

**Rationale**: `CatalogService._loadBaseProducts()` walks every page of `GET /products` once per
session and caches the result in a `Map`, because market listing rows lack description, unit,
images and English names. Those rows carry `categoryId`. Counting them is a pure in-memory
reduction over data already paid for.

**Alternatives rejected**:
- *One `GET /products?categoryId=X` per category.* N requests on page load for a decorative number.
- *Omitting counts.* The request asks for them and they can be made real, so omission is a worse
  answer than a truthful count.

**Honesty caveat**: this counts the **catalog**, not the selected market's listings. Per-market
counts would need a total the cursor-paginated listing endpoint does not return. The label is
therefore worded as a catalog count, and this is recorded in the Gap Register.

---

## R4. What real data exists for "each market has a strength"?

**Decision**: use the market's own `Description` as the speciality line; omit the line when empty.
Extend `MarketSelectionService.Market` to carry `imageUrl` and `description`.

**Rationale**: `MarketDto` (`Catalog.Application/Dtos/MarketDto.cs`) already carries
`ImageUrl` and `Description`, and `GET /api/v1/markets` is public. The web client currently maps
only `id`, `name`, `address` and throws the rest away. Reading two more fields turns an invented
section into a real one.

**Alternatives rejected**:
- *Hardcoding "Thủ Đức = rau củ, Bình Điền = hải sản".* This is exactly the invented business
  logic the request forbids. Those pairings may be true, but the system does not assert them.
- *A new speciality field on the backend.* Correct long-term; out of scope for a front-end feature.

---

## R5. How should baskets and business kinds be stubbed without inventing business logic?

**Decision**: one `StorefrontStubService` exposing three typed readers, with every returned record
carrying a `source: 'stub'` marker, and a file-level comment naming the gap.

**Rationale**: An audit of both repositories found no endpoint, table, migration, DTO or enum for
recommended baskets, business kinds, or market specialities. The honest options were to omit the
sections or to stub them behind a seam. The request explicitly requires the sections, and also
explicitly requires that gaps be surfaced rather than invented, so: build the sections, isolate
the fabricated data in one place, mark it in the type system, and register the gap.

The stub resolves basket members **by product name against the real catalog**, so a basket line
only becomes addable if a real listing backs it. Lines that resolve to nothing render as
unavailable. This means the stub can never put a fake price or a fake product into a real order.

**Alternatives rejected**:
- *Hardcoding product IDs.* Would break against any database that is not the author's.
- *Scattering the stub data across the components that use it.* Would make the eventual endpoint
  swap a multi-file change and hide the gap from review.
- *Omitting the sections.* Contradicts the request, which named them as mandatory scope.

---

## R6. What is the correct Angular idiom here for enter/leave motion?

**Decision**: Angular's native `animate.enter` / `animate.leave` bindings with the Fuse animation
utility classes, plus CSS transitions for hover and active states.

**Rationale**: `src/@fuse/styles/animations.scss` is explicitly documented as the CSS replacement
for the removed `@angular/animations` triggers, and 21 utilities already exist. Existing header
components use exactly this idiom. At `MOTION_INTENSITY 4` nothing more is warranted.

**Alternatives rejected**:
- *GSAP / ScrollTrigger.* A new dependency for a trust-first B2B page. Also banned by the dial.
- *`window.addEventListener('scroll')`.* Explicitly banned by the design skill and jank-prone.
- *`@angular/animations`.* Removed from this project on purpose.

---

## R7. How is the page kept inside the per-component style budget?

**Decision**: split into 8 section components, each with its own stylesheet.

**Rationale**: `angular.json:55` sets `anyComponentStyle` to **error** at 90 KB. Today's single
`home.component.scss` is 15.2 KB for a far simpler page. The budget is measured per component, so
splitting converts one file approaching the ceiling into eight comfortably below it. This is a
real engineering reason for the split, independent of readability.

---

## R8. Does anything about this page need SignalR?

**Decision**: no.

**Rationale**: Constitution principle II requires live prices on the Restaurant surface, and the
catalog's price board is where that lives. The landing is an entry surface showing a snapshot;
subscribing it to a price hub would add a connection per visitor, including guests, for numbers
they are about to see again on the catalog page. Recorded as a deliberate choice in the
Constitution Check rather than an oversight.
