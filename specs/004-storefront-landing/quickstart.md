# Quickstart: Storefront Landing

## Run it

```bash
cd freshflow-web
npm start                 # http://localhost:4200/home
npm start -- --port 4299  # port used by the /verify pass
```

The page needs a market selected to show anything market-scoped. Pick one from the header's
market picker; the choice persists in `localStorage` under `freshflow.selectedMarket`.

## See each section with data

| Section | What it needs to be non-empty |
|---|---|
| Hero board | A market with at least one featured listing |
| Hàng đẹp hôm nay | Same. Mark listings featured via `PATCH /markets/{id}/products/{pid}/featured` (admin or market agent) |
| Đi một vòng quanh chợ | Product categories that have products |
| Mỗi chợ một thế mạnh | At least one active market. `Description` and `ImageUrl` populate the speciality line and tile art |
| Mọi người thường mua | Catalog products whose names match the stub basket members. Unmatched lines render as unavailable **on purpose** |
| Mai bán gì? | Nothing. Stub-driven |
| Cut-off | `GET /orders/ordering-window` reachable. Without it, the timer is intentionally absent |
| Process, Final CTA | Nothing. Static |

## Verify the honesty rules

```bash
# Zero em-dashes in the new namespace (must print nothing)
grep -n '"home\.' public/i18n/vi.json public/i18n/en.json | grep -P '[–—]'

# Key parity between locales (must print nothing)
diff <(grep -o '"home\.[^"]*"' public/i18n/vi.json | sort) \
     <(grep -o '"home\.[^"]*"' public/i18n/en.json | sort)

# Every stub is marked and greppable
grep -rn "source: 'stub'" src/app/modules/home/
```

## Gate before merge

```bash
npm run precheck   # lint -> prettier -> contrast -> unit tests -> production build
```

Do not bypass the Husky hooks. If the style budget fails, the offending component's stylesheet has
crossed 90 KB; split the section rather than raising the budget.

## Known stubs

Three things on this page are placeholders, all isolated in `storefront-stub.service.ts` and all
marked `source: 'stub'` in the type system:

1. **Recommended baskets** - which products a phở shop or a rice shop buys together.
2. **Business kinds** - the four kitchen types and their ingredient counts.
3. **Market speciality fallback** - used only when a market has no `description`.

None of these exist in the backend. They are illustrative and **must be confirmed by product
before launch**. See the Gap Register in [plan.md](./plan.md).
