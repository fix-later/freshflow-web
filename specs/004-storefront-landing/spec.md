# Feature Specification: Storefront Landing - "Chợ hôm nay có gì?"

**Feature Branch**: `landingpage`

**Created**: 2026-08-07

**Status**: Draft

**Input**: User description: "Redesign /home into 'Chợ hôm nay có gì?', a Vietnamese wholesale-market storefront landing for F&B buyers, with 9 ordered sections driving Discover → Browse → Collect → Order. Reuse ProductCardComponent, CatalogService, DraftOrderService, FavoritesService, MarketSelectionService. Real cut-off from GET /orders/ordering-window. Stub baskets/specialties/business-types as typed models with TODOs. Bilingual vi/en."

## Context

`/home` today is a brochure: 419 lines of hardcoded Vietnamese mock data (mock products, mock blog posts, a countdown to an invented sale), zero translation keys, and no connection to any real listing. It cannot convert, because nothing on it can be bought.

This feature replaces that page with a **shopping surface**: a landing whose job is to move a restaurant buyer from arrival to a placed order. The organising metaphor is walking into a wholesale market - you enter, you walk the aisles, you see what looks good today, you fill a basket, you order before the market closes.

The buyer is an F&B operator (quán ăn, nhà hàng) who buys the same categories of goods repeatedly, on a next-day cycle. They are not browsing for pleasure. Every section must earn its place by answering a purchase question.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Arrive and buy today's good stock (Priority: P1)

A restaurant owner opens FreshFlow in the morning. The page opens on their chosen market and immediately shows what is worth buying there today. They add two or three items to their order without navigating anywhere else, then continue to checkout.

**Why this priority**: This is the shortest path from arrival to revenue, and it is the only story that makes the page a storefront rather than a poster. If nothing else ships, this alone justifies the redesign.

**Independent Test**: Load `/home` with a market selected and at least one featured listing. Confirm the buyer can read a real price and add a real item to the draft order without leaving the page, and that the header's order count increases.

**Acceptance Scenarios**:

1. **Given** a market is selected and it has featured listings, **When** the buyer opens `/home`, **Then** today's listings are shown with real name, price, and unit for that market.
2. **Given** today's listings are shown, **When** the buyer activates add-to-order on a listing, **Then** that listing joins the draft order and the header's order indicator reflects the new count.
3. **Given** no market has been selected yet, **When** the buyer opens `/home`, **Then** the page invites them to choose a market rather than showing an empty or misleading product area.
4. **Given** the selected market has no featured listings, **When** the buyer opens `/home`, **Then** the section states that plainly and offers a route into the full catalog.

---

### User Story 2 - Find the aisle I need (Priority: P1)

The buyer knows roughly what they need (vegetables, seafood) but not the specific product. They either type it into the search on the page, or pick a market zone, and land in the catalog already filtered.

**Why this priority**: Search and category entry are the two highest-intent actions on any storefront landing. They are the page's primary navigation, and without them the page is a dead end.

**Independent Test**: Type a term into the page's search and confirm arrival at the catalog with that term applied. Separately, activate a zone and confirm arrival at the catalog filtered to that category.

**Acceptance Scenarios**:

1. **Given** the buyer is on `/home`, **When** they submit a search term, **Then** they arrive at the catalog with that term applied as a filter.
2. **Given** the buyer submits an empty search, **When** the form is submitted, **Then** they arrive at the unfiltered catalog rather than an error state.
3. **Given** the market zones are shown, **When** the buyer activates a zone, **Then** they arrive at the catalog filtered to that zone's category.
4. **Given** a zone's category has artwork, **When** the zones are shown, **Then** that artwork is used; **Otherwise** a consistent fallback marker is shown so the row keeps one rhythm.

---

### User Story 3 - Order everything my kitchen needs tomorrow (Priority: P2)

Rather than hunting for eight ingredients one at a time, the buyer picks the basket that matches their business (a phở shop, a rice shop) reviews its contents, drops what they do not need, adjusts quantities, and adds the rest in one action.

**Why this priority**: This is the largest single lift to order value and the clearest expression of "the system understands my kitchen". It ranks below P1 only because it depends on data the backend does not yet expose.

**Independent Test**: Open a basket, remove one line, change one quantity, add the basket, and confirm the draft order contains exactly the remaining lines at the adjusted quantities.

**Acceptance Scenarios**:

1. **Given** a basket is shown, **When** the buyer opens it, **Then** every product in it is listed with its real current price at the selected market.
2. **Given** a basket is open, **When** the buyer excludes a line, **Then** that line is not added when the basket is added.
3. **Given** a basket is open, **When** the buyer changes a line's quantity, **Then** the basket is added at that quantity.
4. **Given** a basket contains a product the selected market does not list, **When** the basket is shown, **Then** that line is marked unavailable and is excluded from the add action.
5. **Given** a basket has been added, **When** the buyer views their draft order, **Then** it contains one line per included basket product.

---

### User Story 4 - Order before the market closes (Priority: P2)

The buyer sees how long is left to order for tomorrow's delivery, and what happens if they miss it.

**Why this priority**: The daily cut-off is a real operational constraint that already exists in the system. Surfacing it converts a limitation into urgency, and it is the one urgency device on this page that is factually true.

**Independent Test**: With a known cut-off configured, confirm the page shows the remaining time before it, and shows the correct delivery day both before and after that moment.

**Acceptance Scenarios**:

1. **Given** the cut-off is known and has not passed, **When** the buyer views the section, **Then** the time remaining until it is shown and counts down.
2. **Given** the cut-off has passed for today, **When** the buyer views the section, **Then** the page says the order will be delivered on the following cycle instead, without implying the buyer has missed out entirely.
3. **Given** the cut-off cannot be determined, **When** the buyer views the section, **Then** no countdown and no invented time are shown; the section falls back to its non-timed message.

---

### User Story 5 - Understand what happens after I order (Priority: P3)

A first-time buyer wants to know what FreshFlow physically does between their order and their delivery, before committing money on credit terms.

**Why this priority**: Trust work. It matters for first conversion on a credit-terms product but adds nothing for the returning buyer, who is the majority of traffic.

**Independent Test**: Confirm the operational sequence is readable end to end on both a wide and a narrow viewport.

**Acceptance Scenarios**:

1. **Given** the buyer views the process section, **When** they read it, **Then** the real operational sequence is shown in order from order placement to delivery.
2. **Given** a narrow viewport, **When** the section is shown, **Then** the sequence remains legible in a single column with its order preserved.

---

### Edge Cases

- **No market selected.** Everything market-scoped (today's listings, baskets, market strengths) shows a "choose a market" state, not an empty grid. The page must never look broken to a first-time visitor.
- **Guest visitor.** Guests may read the whole page. Data requests that require a session fail silently into empty states rather than error banners.
- **Market has zero featured listings.** The section says so and routes to the full catalog.
- **A basket references a product not listed at this market.** That line renders as unavailable and is excluded from the add action, rather than silently dropped or added at a fake price.
- **Cut-off unavailable.** No countdown, no invented deadline.
- **Category has no artwork.** A consistent fallback marker keeps the zone row's rhythm.
- **Buyer's language is English.** Every string, including zone names and basket names, follows the active language.
- **Reduced motion preference.** All reveal and countdown motion collapses to static.
- **Product with no price.** Shown without a price rather than as free or as zero.

## Requirements *(mandatory)*

### Functional Requirements

**Page composition**

- **FR-001**: The landing MUST present nine sections in this order: hero, today's picks, market zones, market strengths, recommended baskets, tomorrow's menu baskets, order cut-off, operational process, closing call to action.
- **FR-002**: Each section MUST answer at least one purchase question: what do I buy, what is worth buying today, where do I find it, what does my kitchen need, which market is strong in this, when must I order by, what happens after I order.
- **FR-003**: The landing MUST keep its existing route path so existing links and entry points continue to work.
- **FR-004**: No two sections may use the same layout family, so the page does not read as a template.

**Buying**

- **FR-005**: Buyers MUST be able to add a listing to their draft order directly from the landing, without navigating away.
- **FR-006**: Buyers MUST be able to add a whole basket to their draft order in one action.
- **FR-007**: Buyers MUST be able to exclude individual lines from a basket and adjust each line's quantity before adding it.
- **FR-008**: Prices, units and stock shown on the landing MUST be the selected market's real current values, never placeholders.
- **FR-009**: The landing MUST NOT offer prepaid checkout; ordering follows the established credit-terms flow.

**Discovery**

- **FR-010**: The landing MUST provide a search that submits into the catalog with the buyer's term applied.
- **FR-011**: The landing MUST present product categories as market zones that route into the catalog filtered to that category.
- **FR-012**: The landing MUST present the available markets with what each is known for and a route into that market.
- **FR-013**: Category and market artwork MUST be used when it exists, with a consistent fallback when it does not.

**Cut-off**

- **FR-014**: The landing MUST show the real daily order cut-off and the time remaining until it.
- **FR-015**: After the cut-off has passed, the landing MUST show the next delivery cycle rather than a negative or expired timer.
- **FR-016**: When the cut-off cannot be determined, the landing MUST show no timer at all rather than a default or invented one.

**Honesty**

- **FR-017**: The landing MUST NOT display fabricated activity: no invented recent buyers, no invented viewer counts, no invented stock scarcity, no invented realtime events.
- **FR-018**: Any figure presented as a count MUST be derived from real data or omitted.

**Language and access**

- **FR-019**: Every buyer-visible string MUST be translated in both supported languages, with no literal text in the page itself.
- **FR-020**: All interactive controls, including quantity steppers and horizontal rails, MUST be operable by keyboard with a visible focus indicator.
- **FR-021**: All motion MUST collapse to static when the buyer has expressed a reduced-motion preference.
- **FR-022**: Text and interactive elements MUST meet the project's established contrast floor.

**Responsiveness**

- **FR-023**: The landing MUST be usable on a narrow viewport, with search, zones, product tiles, quantity controls and basket actions all reachable.
- **FR-024**: On a wide viewport the landing MUST use the horizontal space rather than presenting a single stacked column.

### Key Entities

- **Market zone**: a product category presented as a physical area of the market. Carries a display name per language, optional artwork, a zone marker, and a count of what is listed in it.
- **Market strength**: a market together with what it is known for. Carries the market's name, its speciality, its location, optional artwork, and how many items it lists.
- **Recommended basket**: a named set of products a given kind of kitchen buys together. Carries a display name per language, the kind of business it serves, and its member products. Each member is resolvable to a real listing at the selected market, or marked unavailable.
- **Business kind**: a type of F&B operation (noodle shop, rice shop, drinks stall, hotpot restaurant) used to label baskets and to tell the buyer which basket is theirs. Carries a display name per language and how many ingredients it typically needs.
- **Order window**: the daily deadline after which orders move to the following delivery cycle, and the number of days between order and delivery.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A buyer arriving with a market already chosen can place their first item into an order in under 15 seconds, without leaving the landing.
- **SC-002**: A buyer can assemble a multi-ingredient order for their kind of kitchen in under 60 seconds using a basket, against roughly 8 separate searches today.
- **SC-003**: Every one of the nine sections is reachable and legible at both a narrow and a wide viewport, with no horizontal page scrolling at either.
- **SC-004**: 100% of buyer-visible strings render in the buyer's chosen language, verified by switching language and finding no untranslated text.
- **SC-005**: Zero fabricated data points appear on the page, verified by tracing every displayed number and name to a real source or to a declared stub.
- **SC-006**: The page presents at least three distinct routes into the catalog (search, a zone, a market), so no buyer reaches the bottom without an offered next step.
- **SC-007**: A buyer using only a keyboard can reach and operate the search, one product's add action, and one basket's quantity control.

## Assumptions

- **The buyer's market is the page's scope.** Prices and availability are per-market in this system, so the landing shows one market at a time, the one chosen in the header. This mirrors how the catalog already behaves.
- **Baskets, market strengths and business kinds have no backend.** An audit of both the web and backend repositories found no endpoint, table or model for any of them. They are specified here as typed front-end stubs with explicit markers, shaped so a future endpoint can replace the stub without changing any consuming component. **This is a declared gap, not invented business logic** - the sets are illustrative and must be confirmed before launch.
- **The cut-off is real and already available.** The system exposes a daily cut-off and a delivery window, and an existing surface already consumes it. This feature reuses that source rather than defining a second rule.
- **"Tomorrow" means the next delivery cycle**, whose length is whatever the order window reports, rather than a hardcoded one day.
- **Featured listings are the basis of "today's picks".** The system already lets an operator pin listings per market, and the listing endpoint returns every pinned row on the first page, so the landing can show them in a single request.
- **Existing shared building blocks are reused, not rebuilt** - the product tile, the catalog data access, the draft order, the favourites, and the market selection all exist and are consumed as they are.
- **Guests may read the page.** The route already admits unauthenticated visitors, and requests needing a session degrade to empty states.
- **Brand colours come from the project's own token file**, which records the navy as `#313F90`. The value `#131F90` given in the request does not occur anywhere in the repository and is treated as a typo; see the gap note in the plan.
- **Product photography comes from the catalog.** No stock imagery or placeholder image service is introduced; sections without data fall back to typographic and token-tinted treatments.
