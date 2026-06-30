# FreshFlow Web — Catalog UI References (UC-CAT-01)

**Layer:** Design. Subordinate to Business ([`../product/PRD.md`](../product/PRD.md)) and UX;
authoritative for look-and-feel. Extends [`README.md`](./README.md) for the product-catalog
feature. **References only — do not clone**: extract layout, spacing, hierarchy, and interaction
patterns; never lift exact colors or assets (per [`../design/DESIGN.md`](../design/DESIGN.md) and
[`../design/TOKENS.md`](../design/TOKENS.md)).

## Console framing (read first)

FreshFlow is an **operational console, not a storefront** (DESIGN.md: "Google Workspace ×
Material 3 — calm, dense, content-first"). The references below are mostly consumer/commerce apps,
so adopt their **structure and interaction patterns**, but pull density and chrome toward the
console direction: slim app bar, quiet nav, dividers over shadows, type/spacing carrying hierarchy.

## Source screens (Mobbin, web)

### Catalog / listing
| App | Pattern to extract | Link |
|-----|--------------------|------|
| Faire (**closest — B2B**) | Left sidebar filters + category chip row + top search + responsive card grid | [screen](https://mobbin.com/screens/480d09ae-f21b-4eb2-afd5-4f48ac14d088) |
| Instacart | Horizontal category/subcategory **chip row** above the grid | [screen](https://mobbin.com/screens/6a27f5b9-da65-4db7-9509-9b8a57cabd16) |
| Shop | Search field aligned right of the chip/sort toolbar row | [screen](https://mobbin.com/screens/438cb337-90ed-42e3-a6d7-bfd67a44df2a) |
| DoorDash | "Showing results for X" + **result count** + filter chips (empty/result state) | [screen](https://mobbin.com/screens/3c74fa75-b0d8-4e27-a9c8-369a4b4ee78b) |

### Product detail
| App | Pattern to extract | Link |
|-----|--------------------|------|
| Faire (**closest — B2B**) | 2×2 image gallery left, info column right; no consumer-checkout emphasis | [screen](https://mobbin.com/screens/26c94788-659a-49b2-bed5-21713dc5ed71) |
| Instacart | Thumbnail rail + main image; **collapsible** Details/Ingredients sections | [screen](https://mobbin.com/screens/4004263e-3cc4-4b62-9c79-5a54d086fed7) |
| Amazon | Breadcrumb, thumbnail rail, **attribute table** for product facts | [screen](https://mobbin.com/screens/fc20d04c-8ce2-4705-8e4e-2be4d26eb00b) |
| IKEA | Sticky right info panel + "Related products" rail | [screen](https://mobbin.com/screens/11c22276-5c26-4bd2-a34e-a855a2e8adac) |

## Layout decisions mapped to the data model

Fields available on `CatalogProduct` (`src/app/modules/catalog/catalog.types.ts`):
`name`/`nameEn`, `description`/`descriptionEn`, `categoryId`, `unit`/`unitEn`, `marketSource`,
`thumbnail`, `images[]`, `active`. **No `price`, no rating, no add-to-cart.**

| Area | Decision | Source |
|------|----------|--------|
| Listing toolbar | Single row: category chips left, search right; "All" chip first, active state on selection | Shop, Instacart |
| Result feedback | Result-count line + active-filter summary above the grid | DoorDash |
| Card | Image-dominant: `thumbnail` → `name` → meta line (`unit` · `marketSource`); responsive grid, generous gutters | Faire |
| Detail gallery | Thumbnail rail + large main image (or 2×2) from `images[]` | Instacart / Faire |
| Detail metadata | Attribute table: `unit`, `marketSource`, category name | Amazon |
| Detail body | Collapsible section for `description` long copy | Instacart |

## ⚠️ Open gap (do not invent)

The catalog model has **no price, rating, or add-to-cart**, yet the references center cards/detail
on price + "Add to cart". Per the resolved B2B credit/debt decision (PRD § Resolved Conflicts — not
prepaid checkout) and the "don't invent" rule, **do not copy consumer price/cart emphasis**. The
catalog reads as browse-only. **Confirm with Business/UX** whether pricing belongs on the catalog at
all or only later in the order flow before adding any price affordance.
