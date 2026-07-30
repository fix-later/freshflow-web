# FreshFlow Web — Design Tokens

**Layer:** Design. These tokens are the **single source for color, type, spacing, elevation,
and breakpoints**. They are **already defined in the repo** — bind to them, never hardcode.

-   **Color**: Fuse theming CSS custom properties (`--fuse-*`) + Tailwind `tailwind.config.js`.
-   **Type / spacing / breakpoints**: `tailwind.config.js` (`theme`).
-   **Tailwind is layout-only**; color/type/elevation come from Material + these tokens.

## Color tokens

The app ships **two brand colors**: FreshFlow navy `#313F90` (primary) and FreshFlow mint
`#50F0A3` (secondary; Material calls this slot `accent`), plus **red** for warn and **pink**
`#F0508A` for discounted prices. All are declared **once**, in `customPalettes` in
`tailwind.config.js`, and expanded into full ramps by `generatePalette`.

**Navy carries the work; mint is the highlight.** Headings, prices, primary buttons and active
nav are navy; mint appears in small doses (hover states, highlights, and on dark surfaces where
navy would be invisible). The storefront reference this palette comes from uses them at roughly
8:1 in navy's favour. The inverse — mint as primary — put `#50F0A3` text on white surfaces at
**1.47:1** measured contrast, a WCAG AA failure; navy on white measures ~10:1.

Mint's one non-negotiable use: **dark surfaces**. The auth brand panel and the admin sidebar are
near-black, where navy cannot be read — those bind `accent`, never `primary`.

> ⚠️ `src/@fuse/styles/user-themes.scss` is **generated** by the Fuse theming plugin from that
> config on every build — hand-edits are silently overwritten. Change color in
> `tailwind.config.js` and nowhere else. The plugin derives both the Tailwind utilities
> (`bg-primary`) and the Material theme + `--fuse-*` variables from the same source, so the two
> can never drift.

| Role (M3)          | Token                                      | Source                                  |
| ------------------ | ------------------------------------------ | --------------------------------------- |
| Primary            | `--fuse-primary` / `bg-primary`            | `#313F90` palette (500 base, 600 hover) |
| On primary         | `--fuse-on-primary` / `text-on-primary`    | generated contrast (white)              |
| Secondary / accent | `--fuse-accent` / `bg-accent`              | `#50F0A3` palette                       |
| Warn / error       | `--fuse-warn` / `text-warn`                | red-600                                 |
| Sale / discount    | `--fuse-sale` / `text-sale`                | `#F0508A` palette                       |
| Surface (card)     | `--fuse-bg-card` / `bg-card`               | theme                                   |
| Background         | `--fuse-bg-default` / `bg-default`         | theme                                   |
| Dialog surface     | `--fuse-bg-dialog`                         | theme                                   |
| Text default       | `--fuse-text-default` / `text-default`     | theme                                   |
| Text secondary     | `--fuse-text-secondary` / `text-secondary` | theme                                   |
| Text hint          | `--fuse-text-hint` / `text-hint`           | theme                                   |
| Text disabled      | `--fuse-text-disabled` / `text-disabled`   | theme                                   |
| Border / divider   | `--fuse-border` / `--fuse-divider`         | theme                                   |

Status (semantic, pair with icon/label): success → mint (`accent`); warning → amber; error →
warn red; info → blue; **discounted price → `sale` pink** (the struck-through original stays
`text-hint`). Use these tokens; do not introduce new hex.

> Light & dark themes are provided by Fuse (`.light` / `.dark`). All tokens resolve per theme —
> never assume a fixed background or text color.

## Typography

Fonts (from `tailwind.config.js`): **Google Sans Flex** (`font-sans`) for UI, **IBM Plex Mono**
(`font-mono`) for numeric/code (prices, IDs). Both load from Google Fonts in `src/index.html`.

> **Resolved — font family.** The brief [`MATERIAL3.md`](./MATERIAL3.md) asked for Roboto and
> this file previously documented Inter; the app ships **Google Sans Flex**, and the bundled
> Inter webfont (465 KB, `public/fonts/inter`) was deleted since nothing referenced it. Components
> bind to `font-sans` only — never a hardcoded family — so a future swap stays a one-line change.

Map Material 3 type roles to the existing Tailwind `fontSize` scale:

| M3 role    | Tailwind class        | Size          | Use                 |
| ---------- | --------------------- | ------------- | ------------------- |
| Display    | `text-5xl`–`text-7xl` | 2.25–3rem     | Marketing/auth only |
| Headline   | `text-3xl`/`text-4xl` | 1.5–2rem      | Page titles         |
| Title      | `text-xl`/`text-2xl`  | 1.125–1.25rem | Section/card titles |
| Body large | `text-lg`             | 1rem          | Emphasis body       |
| Body       | `text-base`           | 0.875rem      | Default text        |
| Label      | `text-md`             | 0.8125rem     | Table cells, labels |
| Caption    | `text-sm`/`text-xs`   | 0.625–0.75rem | Metadata, hints     |

Numbers (prices, quantities, balances) use `font-mono` + `tabular-nums` for aligned columns.

## Spacing

**8pt rhythm** (per [`MATERIAL3.md`](./MATERIAL3.md)) on Tailwind's 4px base — prefer even
steps (`2`=8px, `4`=16px, `6`=24px, `8`=32px); reserve odd/4px steps for fine table tuning.
Page/section rhythm:

| Token           | Value   | Use                                   |
| --------------- | ------- | ------------------------------------- |
| `p-2` / `gap-2` | 8px     | Dense table cell padding              |
| `p-4` / `gap-4` | 16px    | Default control spacing               |
| `p-6`           | 24px    | Card/section padding                  |
| `p-8`           | 32px    | Page padding (≥ md)                   |
| `gap-6`–`gap-8` | 24–32px | Section separation (large whitespace) |

Custom steps available in config (`13, 15, 18, 22, 26, 30, …`) for fine layout tuning.

## Breakpoints

From `tailwind.config.js` (mobile-first):

| Name | Min width |
| ---- | --------- |
| `sm` | 600px     |
| `md` | 960px     |
| `lg` | 1280px    |
| `xl` | 1440px    |

Drives the responsive rules in [`../ux/SCREEN_RULES.md`](../ux/SCREEN_RULES.md).

## Elevation & shape

-   **Elevation 0–2 only** (per [`MATERIAL3.md`](./MATERIAL3.md)). Prefer `--fuse-border`/dividers
    over shadow; reserve level 2 for transient surfaces (menus, dialogs).
-   **Radius**: Material 3 default rounding via theme; tables square, cards/dialogs sm–md radius.
-   **Icon sizing**: use the Fuse `icon-size` utility (`icon-size-5`, etc.), not ad-hoc widths.

## Rule

If a value isn't in these tokens, it doesn't belong in a component. Add to
`tailwind.config.js` / the theme, not to a component stylesheet (no custom CSS — see
[`../engineering/ANGULAR.md`](../engineering/ANGULAR.md)).
