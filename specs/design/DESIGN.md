# FreshFlow Web — Design Principles

**Layer:** Design. Subordinate to Business + UX; authoritative for look-and-feel. Visual
references live in [`../references/README.md`](../references/README.md) (extract layout,
spacing, hierarchy — never clone). Execution is **Angular Material (Material 3)** themed via the
Fuse system; **Tailwind for layout only**; **no custom CSS**.

## Design language

**Google Workspace × Material 3** — an operational console, not a storefront. Calm, dense,
content-first. The product's job is to surface live prices, orders, and logistics data quickly
and let operators act with confidence. The short directive brief is
[`MATERIAL3.md`](./MATERIAL3.md) (source); this file expands it.

## Principles

1. **Simple** — one primary action per screen; remove anything that isn't data or a decision.
2. **Operational** — optimize for repeat, high-frequency tasks (price scan, order, batch review).
3. **Minimal** — restrained color; type and spacing carry the hierarchy, not borders/shadows.
4. **Content first** — data fills the viewport; chrome stays thin (slim app bar, quiet nav).
5. **Low elevation** — flat surfaces, dividers over shadows; Material elevation **0–2** only.
6. **Dense tables** — collections default to compact tables; comfortable density is for forms.
7. **Large whitespace** — generous page/section padding frames the dense content and reduces
   cognitive load.

## Color usage

Brand is **FreshFlow navy** (`#313F90`, the Tailwind `primary`/`--fuse-primary`) with
**FreshFlow mint** (`#50F0A3`, `accent`) as the secondary. Color is **functional, not
decorative**:

-   **Primary (navy)** — headings, prices, primary actions, active nav.
-   **Secondary (mint)** — highlights and hover states, in small doses; and anything sitting on
    a dark surface, where navy is unreadable.
-   **Sale (pink)** — discounted prices only, never as decoration.
-   **Neutral structure** — text, surfaces and borders come from the theme's slate greys
    (`text-default`/`bg-card`/`--fuse-border`), not from a brand color.
-   **Warn (red)** — destructive actions and errors only.
-   **Status colors** — semantic only (success/warn/error/info) for order/delivery/credit states.

Never use raw hex in components — bind to tokens (see [`TOKENS.md`](./TOKENS.md)). Light and
dark themes both supported via the Fuse theming system; design must read in both.

## Hierarchy

-   Establish hierarchy with **type scale + weight + spacing**, then color as a last resort.
-   Page header → section → row. Keep to **three visual levels** per screen.
-   Tables: emphasize the identifying column (name/ID) and the actionable column (status/total);
    de-emphasize metadata.

## Accessibility (non-negotiable)

-   WCAG AA contrast for text and UI; never rely on color alone for status (pair with label/icon).
-   Full keyboard operability; visible focus (Material focus rings — do not remove).
-   Respect `prefers-reduced-motion` (see [`MOTION.md`](./MOTION.md)).
-   All interactive elements have accessible names; tables use proper header semantics.

## Do / Don't

| Do                              | Don't                                  |
| ------------------------------- | -------------------------------------- |
| Flat sections with dividers     | Nested cards with heavy shadows        |
| Navy for the one primary action | Mint as a background/decoration        |
| Dense tables for lists          | Card grids for long operational lists  |
| Tokens for color/type/elevation | Hardcoded hex / px / custom CSS        |
| Tailwind for layout             | Tailwind for colors/typography/shadows |
