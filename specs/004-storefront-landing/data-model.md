# Phase 1 Data Model: Storefront Landing

Models introduced by this feature live in
`src/app/modules/home/storefront-landing.types.ts`. Everything else is consumed from existing
types (`CatalogProduct`, `CatalogCategory`, `Market`, `OrderingWindow`, `ProductCardVm`) unchanged.

Types are grouped by whether their **data** is real or stubbed. The shapes are all real: a future
endpoint replaces the source without changing any consumer.

---

## Real-data models

### `MarketZone`

One product category presented as an area of the market.

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | `string` | `CatalogCategory.id` | Routes to `/catalog?category={id}` |
| `name` | `string` | `CatalogCategory.name` | Vietnamese |
| `nameEn` | `string` | `CatalogCategory.nameEn` | Falls back to `name` |
| `imageUrl` | `string` | `CatalogCategory.imageUrl` | Empty when the category has no artwork |
| `marker` | `string` | Derived | Zone emoji, matched by slug, else a default |
| `itemCount` | `number` | `CatalogService.categoryCounts()` | Catalog-wide, not market-scoped |

**Rules**
- A zone is only shown if `itemCount > 0`. An empty aisle is not worth walking into.
- Zones are ordered by `itemCount` descending, so the biggest aisle leads.
- Root categories only; children roll their counts up into their parent.

### `MarketStrength`

A market plus what it is known for.

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | `string` | `Market.id` | |
| `name` | `string` | `Market.name` | |
| `address` | `string` | `Market.address` | Optional |
| `imageUrl` | `string` | `Market.imageUrl` | **New** on `Market`; empty falls back to a marker tile |
| `specialty` | `string` | `Market.description` | **New** on `Market`; omitted entirely when empty |
| `isSelected` | `boolean` | Derived | The market currently being shopped |

**Rules**
- Selecting a market card calls `MarketSelectionService.select()` and re-scopes the whole page.
- The currently selected market is marked, not hidden - the buyer needs to see where they are.
- `specialty` is never invented. No description means no speciality line.

### `OrderCutoffView`

The countdown state, derived from `OrderingWindow`.

| Field | Type | Notes |
|---|---|---|
| `known` | `boolean` | `false` when the endpoint failed; suppresses the whole timer |
| `isOpen` | `boolean` | Before today's cut-off |
| `cutoffLabel` | `string` | e.g. `22:00`, formatted from `cutoffTime` |
| `remainingMs` | `number` | Recomputed each second while open |
| `deliveryWindowDays` | `number` | Drives "delivered tomorrow" vs a longer horizon |

**State transitions**
```
unknown ──(fetch ok, before cutoff)──▶ open ──(clock passes cutoff)──▶ closed
   │                                                                     │
   └──(fetch fails)──▶ unknown (no timer rendered, permanent for session) │
                                                                          ▼
                                                      shows next delivery cycle
```

**Rules**
- `known: false` renders **no** time at all. Never a default, never a guess.
- `remainingMs` never goes negative; reaching zero flips `isOpen` to `false`.
- The ticking interval is cleared on destroy and never starts under reduced motion (the value is
  shown statically instead).

---

## Stubbed-data models

Every record below carries `source: 'stub'`. The literal type makes the marker impossible to drop
silently when a real source arrives, and makes the stub greppable.

### `BusinessKind`

A type of F&B operation.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | `'noodle' \| 'rice' \| 'drinks' \| 'hotpot'` |
| `name` | `string` | Vietnamese label |
| `nameEn` | `string` | English label |
| `marker` | `string` | Emoji |
| `ingredientCount` | `number` | **Stub.** A property of the placeholder, not a measurement |
| `source` | `'stub'` | |

### `RecommendedBasket`

A named set of products one kind of kitchen buys together.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `businessKindId` | `string` | Links to `BusinessKind` |
| `name` | `string` / `nameEn` | Display labels |
| `memberNames` | `string[]` | **Product names**, not IDs. See resolution below |
| `source` | `'stub'` | |

**Why names and not IDs**: hardcoded product IDs are meaningless outside one database. Names are
resolved against the real catalog at runtime, so the basket degrades honestly on any dataset.

### `BasketLine` (runtime, not stored)

The resolution of one `memberNames` entry against the selected market.

| Field | Type | Notes |
|---|---|---|
| `label` | `string` | The requested product name, shown even when unresolved |
| `product` | `CatalogProduct \| null` | `null` when this market does not list it |
| `quantity` | `number` | Buyer-adjustable, minimum `product.minimumOrderQuantity` |
| `included` | `boolean` | Buyer can exclude a line before adding |
| `available` | `boolean` | `product !== null && product.active` |

**Rules**
- Only lines where `included && available` are added to the draft order.
- An unavailable line is shown, dimmed and labelled, never silently dropped. The buyer should
  learn that this market does not carry it.
- Quantity is clamped to at least `minimumOrderQuantity`, which the backend enforces at
  confirmation anyway (`MINIMUM_ORDER_QUANTITY_NOT_MET`).
- The add action is disabled when no line is both included and available.

---

## Extensions to existing models

### `Market` (`src/app/core/market/market-selection.service.ts`)

```
+ imageUrl?: string     // MarketDto.ImageUrl, already returned by GET /markets
+ description?: string  // MarketDto.Description, already returned, previously discarded
```

Both are optional, so no existing consumer changes. `_reconcileSelection` compares them so a
stored selection refreshes when an operator edits the market.

### `CatalogService` (`src/app/modules/catalog/catalog.service.ts`)

```
+ categoryCounts(): Promise<ReadonlyMap<string, number>>
```

Counts products per `categoryId` from the already-cached base-product list. No new request.
