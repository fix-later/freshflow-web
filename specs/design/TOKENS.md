# FreshFlow Web — Design Tokens

**Layer:** Design. These tokens are the **single source for color, type, spacing, elevation,
and breakpoints**. They are **already defined in the repo** — bind to them, never hardcode.

- **Color**: Fuse theming CSS custom properties (`--fuse-*`) + Tailwind `tailwind.config.js`.
- **Type / spacing / breakpoints**: `tailwind.config.js` (`theme`).
- **Tailwind is layout-only**; color/type/elevation come from Material + these tokens.

## Color tokens

Brand palette is generated from **FreshFlow green `#3BB77E`** (primary) with **slate** (accent)
and **red** (warn). Bind via Tailwind classes (`bg-primary`, `text-on-primary`, `text-secondary`)
or CSS variables.

| Role (M3) | Token | Source |
|-----------|-------|--------|
| Primary | `--fuse-primary` / `bg-primary` | `#3BB77E` palette |
| On primary | `--fuse-on-primary` / `text-on-primary` | generated contrast |
| Accent | `--fuse-accent` | slate-800 |
| Warn / error | `--fuse-warn` / `text-warn` | red-600 |
| Surface (card) | `--fuse-bg-card` / `bg-card` | theme |
| Background | `--fuse-bg-default` / `bg-default` | theme |
| Dialog surface | `--fuse-bg-dialog` | theme |
| Text default | `--fuse-text-default` / `text-default` | theme |
| Text secondary | `--fuse-text-secondary` / `text-secondary` | theme |
| Text hint | `--fuse-text-hint` / `text-hint` | theme |
| Text disabled | `--fuse-text-disabled` / `text-disabled` | theme |
| Border / divider | `--fuse-border` / `--fuse-divider` | theme |

Status (semantic, pair with icon/label): success → primary green; warning → amber; error →
warn red; info → blue. Use Material/Fuse status utilities; do not introduce new hex.

> Light & dark themes are provided by Fuse (`.light` / `.dark`). All tokens resolve per theme —
> never assume a fixed background or text color.

## Typography

Fonts (from `tailwind.config.js`): **Inter** (`font-sans`) for UI, **IBM Plex Mono**
(`font-mono`) for numeric/code (prices, IDs).

> ⚠️ **Open decision — font family.** The design brief [`MATERIAL3.md`](./MATERIAL3.md)
> specifies **Roboto**; the repo currently ships **Inter** (configured in
> `tailwind.config.js` + `public/fonts/inter`). These conflict. Until decided, components bind
> to `font-sans` (no hardcoded family) so a switch is a one-line config change. **Recommended:**
> keep **Inter** — it is already wired, is a Workspace-grade UI face, and avoids a font swap;
> switch the brief to match. If Roboto is required, update the Tailwind `fontFamily.sans` and
> the bundled font, not individual components.

Map Material 3 type roles to the existing Tailwind `fontSize` scale:

| M3 role | Tailwind class | Size | Use |
|---------|----------------|------|-----|
| Display | `text-5xl`–`text-7xl` | 2.25–3rem | Marketing/auth only |
| Headline | `text-3xl`/`text-4xl` | 1.5–2rem | Page titles |
| Title | `text-xl`/`text-2xl` | 1.125–1.25rem | Section/card titles |
| Body large | `text-lg` | 1rem | Emphasis body |
| Body | `text-base` | 0.875rem | Default text |
| Label | `text-md` | 0.8125rem | Table cells, labels |
| Caption | `text-sm`/`text-xs` | 0.625–0.75rem | Metadata, hints |

Numbers (prices, quantities, balances) use `font-mono` + `tabular-nums` for aligned columns.

## Spacing

**8pt rhythm** (per [`MATERIAL3.md`](./MATERIAL3.md)) on Tailwind's 4px base — prefer even
steps (`2`=8px, `4`=16px, `6`=24px, `8`=32px); reserve odd/4px steps for fine table tuning.
Page/section rhythm:

| Token | Value | Use |
|-------|-------|-----|
| `p-2` / `gap-2` | 8px | Dense table cell padding |
| `p-4` / `gap-4` | 16px | Default control spacing |
| `p-6` | 24px | Card/section padding |
| `p-8` | 32px | Page padding (≥ md) |
| `gap-6`–`gap-8` | 24–32px | Section separation (large whitespace) |

Custom steps available in config (`13, 15, 18, 22, 26, 30, …`) for fine layout tuning.

## Breakpoints

From `tailwind.config.js` (mobile-first):

| Name | Min width |
|------|-----------|
| `sm` | 600px |
| `md` | 960px |
| `lg` | 1280px |
| `xl` | 1440px |

Drives the responsive rules in [`../ux/SCREEN_RULES.md`](../ux/SCREEN_RULES.md).

## Elevation & shape

- **Elevation 0–2 only** (per [`MATERIAL3.md`](./MATERIAL3.md)). Prefer `--fuse-border`/dividers
  over shadow; reserve level 2 for transient surfaces (menus, dialogs).
- **Radius**: Material 3 default rounding via theme; tables square, cards/dialogs sm–md radius.
- **Icon sizing**: use the Fuse `icon-size` utility (`icon-size-5`, etc.), not ad-hoc widths.

## Rule

If a value isn't in these tokens, it doesn't belong in a component. Add to
`tailwind.config.js` / the theme, not to a component stylesheet (no custom CSS — see
[`../engineering/ANGULAR.md`](../engineering/ANGULAR.md)).
