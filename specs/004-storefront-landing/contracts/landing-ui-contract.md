# UI Contract: Storefront Landing

The interface this feature exposes is a **page**, not an API. This contract fixes the parts other
work can depend on: the route, the component boundaries, the query parameters it emits, the
translation namespace, and the test hooks.

---

## Route contract

| Property | Value | Stability |
|---|---|---|
| Path | `/home` | **Frozen.** Also the target of the empty-path redirect (`app.routes.ts:20`) |
| Layout | `enterprise`, area `storefront` | Unchanged |
| Guard | `OptionalAuthGuard` | Unchanged. Guests may read the page |
| Loading | Lazy via `home.routes.ts` | Unchanged |

Nothing about the route changes. This feature replaces the component's contents only.

---

## Outbound navigation contract

Every route the landing emits, and the parameters it sets. These must match what
`CatalogComponent` reads, or a link silently lands unfiltered.

| From | Target | Parameters |
|---|---|---|
| Hero search | `/catalog` | `?q={term}` when non-empty, omitted when blank |
| Hero primary CTA | `/catalog` | none |
| Zone tile | `/catalog` | `?category={categoryId}` |
| Today's picks tile | `/catalog/{productId}` | none |
| Today's picks "see all" | `/catalog` | `?featured=1` |
| Market card CTA | `/catalog` | none, after calling `MarketSelectionService.select()` |
| Basket "view in catalog" | `/catalog` | `?q={productName}` |
| Cut-off CTA | `/catalog` | none |
| Final CTA | `/catalog` | none |

**Dependency note**: `?category=` and `?featured=` are already read by `CatalogComponent`.
`?q=` is **not** read today; wiring it is part of this feature's scope, and it must seed
`searchControl` the same way `?category=` seeds `selectedCategory`.

---

## Component boundaries

All are standalone and `OnPush`, and each resolves its own data, so the shell stays a list of tags
and any section can be removed without touching the others. Exactly one takes an input
(`recommended-basket`), which is the single cross-section coupling described below.

| Selector | Section | Emits |
|---|---|---|
| `market-hero` | Hero | navigation only |
| `today-highlights` | Hàng đẹp hôm nay | `DraftOrderService.add`, `FavoritesService.toggle` |
| `market-zones` | Đi một vòng quanh chợ | navigation only |
| `market-specialties` | Mỗi chợ một thế mạnh | `MarketSelectionService.select` |
| `recommended-basket` | Mọi người thường mua | `DraftOrderService.add` (many) |
| `tomorrow-menu` | Mai bán gì? | selects a basket in `recommended-basket` |
| `order-cutoff` | Đơn hàng ngày mai | navigation only |
| `freshflow-process` | Freshflow đi chợ thế nào? | nothing |
| *(inline in shell)* | Final CTA | navigation only |

**Cross-section coupling**: exactly one, between `tomorrow-menu` and `recommended-basket`.
Section 6 emits `kindSelected: output<string>`; the shell holds it in a signal and passes it down
as `recommended-basket`'s `businessKindId` input, then scrolls the basket into view. Neither
section knows the other exists, so either can be deleted without touching the other.

---

## Translation namespace contract

All keys are flat and dotted, matching the existing files. Namespace: **`home.*`**, which is
currently empty (0 of 1912 keys), so there is no collision risk.

```
home.hero.*         home.today.*        home.zones.*       home.markets.*
home.basket.*       home.tomorrow.*     home.cutoff.*      home.process.*
home.finalCta.*
```

**Constraints on values**
- Present in both `vi.json` and `en.json`, no key in one and not the other.
- **Zero em-dash (`—`) or en-dash (`–`) characters** in any value, per the design skill's
  non-negotiable rule. Checked mechanically before ship.
- Interpolation uses `{{name}}`, matching `productCard.addToCartNamed`.

---

## Test hook contract

`data-testid` attributes, stable for the `/verify` pass and any future e2e:

| Hook | On |
|---|---|
| `landing-hero` | Hero section root |
| `landing-search` | Hero search input |
| `landing-today` | Today's picks section root |
| `landing-today-card` | Each product tile in today's picks |
| `landing-zones` | Zones section root |
| `landing-zone` | Each zone tile |
| `landing-markets` | Market strengths section root |
| `landing-basket` | Basket section root |
| `landing-basket-line` | Each basket line |
| `landing-basket-add` | Basket add-all action |
| `landing-tomorrow` | Tomorrow's menu section root |
| `landing-cutoff` | Cut-off section root |
| `landing-process` | Process section root |
| `landing-final-cta` | Final CTA root |

---

## Behavioural guarantees

1. **No section throws.** Every data read degrades to an empty or invitation state. A failed
   request must never blank the page or surface a raw error.
2. **No fabricated values.** Any number shown traces to real data or to a `source: 'stub'` record.
3. **Market-scoped.** Changing the market in the header re-scopes every market-dependent section
   without a reload.
4. **Nothing is added to an order that is not real.** A basket line with no resolved listing is
   excluded from the add action by construction, not by a check that could be forgotten.
5. **Reduced motion is honoured** by every animated element, including the countdown.
