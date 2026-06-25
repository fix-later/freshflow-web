# FreshFlow Web — UI References

**Layer:** Design (authoritative for visual direction).
Subordinate to Business ([`../product/PRD.md`](../product/PRD.md)) and UX;
supersedes Engineering/AI on look-and-feel. This is the **only** place visual guidance is
defined — other docs link here rather than restating it.

## Reference images

| File | Purpose | Use for | Do **not** copy |
|------|---------|---------|-----------------|
| `homepage.png` | Overall visual direction | spacing, composition, hierarchy | exact colors, exact assets |
| `product.png` | Product listing layout | card density, filter placement, content structure | exact colors, exact assets |
| `shop.png` | Commerce interaction | navigation, action hierarchy | exact colors, exact assets |

## Feature reference maps

- [`CATALOG_REFERENCES.md`](./CATALOG_REFERENCES.md) — product catalog & detail (UC-CAT-01):
  Mobbin source screens + layout decisions mapped to the data model.

## Rules

- These images are **references only — do not clone**.
- Extract: **layout, spacing, typography, interaction, component patterns, hierarchy**.
- Do not reproduce visuals literally; do not lift exact colors or assets.
- Implement within the existing Fuse + Angular Material theming and Tailwind tokens
  (see Engineering: [`../../.specify/memory/constitution.md`](../../.specify/memory/constitution.md)).
