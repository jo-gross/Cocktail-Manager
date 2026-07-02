# UI Theme Tokens

Color system defined in `styles/global.css`. Theme is controlled via `data-theme` on `<html>`:

| Value | Behavior |
|-------|----------|
| `light` | Forced light palette |
| `dark` | Forced dark palette |
| *(none)* | Auto – follows `prefers-color-scheme` |

## Base elevation ramp

| Token | Role |
|-------|------|
| `base-100` | Page background, elevated Card surfaces |
| `base-200` | Section surfaces – Collapse, surface Card, table toolbar |
| `base-300` | Borders, inputs, dividers, hover states, table header |
| `base-400` | Strong borders, pressed/deeper surfaces, skeleton fills |

Use Tailwind utilities: `bg-base-100`, `border-base-300`, `text-base-content/60`, etc.

## Component mapping

| Component / pattern | Background |
|---------------------|------------|
| Collapse container | `bg-base-200` |
| `Card variant="elevated"` | `bg-base-100` |
| `Card variant="surface"` | `bg-base-200` |
| Table zebra / row hover | `bg-base-200/40` |
| Table header (sticky) | `bg-base-300/95` + `backdrop-blur` |
| DataTable toolbar | `bg-base-200/50` + `border-base-300/40` |
| Alert (solid) | `bg-{variant}` + `border-{variant}` + `text-{variant}-content` |

## Token values

### Light (`:root`, `data-theme="light"`)

| Token | Value |
|-------|-------|
| base-100 | `#ffffff` |
| base-200 | `#eef1f5` |
| base-300 | `#d4dae4` |
| base-400 | `#b8c2d0` |
| base-content | `#1c2128` |
| primary | `#ee7d16` |
| primary-content | `#231200` |
| secondary | `#2a6f97` |
| secondary-content | `#f0f7fb` |
| accent | `#c07d0a` |
| accent-content | `#fff8ef` |
| neutral | `#2a2f37` |
| neutral-content | `#f2f4f7` |
| info | `#0284c7` |
| success | `#15803d` |
| warning | `#ca8a04` |
| error | `#dc2626` |

### Dark / Auto (`data-theme="dark"` or OS dark)

| Token | Value |
|-------|-------|
| base-100 | `#111620` |
| base-200 | `#1a2130` |
| base-300 | `#252e3f` |
| base-400 | `#323d52` |
| base-content | `#e8ebf2` |
| primary | `#f28c18` |
| primary-content | `#1c0f00` |
| secondary | `#4aa3cf` |
| secondary-content | `#04283b` |
| accent | `#e0a92e` |
| accent-content | `#2a1505` |
| neutral | `#3d4659` |
| neutral-content | `#eef1f5` |
| info | `#38bdf8` |
| success | `#4ade80` |
| warning | `#eab308` |
| error | `#ef4444` |

> **Contrast rule:** `primary` is orange in both light and dark, so `primary-content`
> is intentionally very dark (near-black). White text on orange fails WCAG AA, therefore
> primary buttons, badges and focus states must use the dark `primary-content` foreground.

## Semantic roles

| Token | Use for |
|-------|---------|
| `primary` | Brand CTAs, main actions (orange in light + dark; always dark text) |
| `secondary` | Secondary actions, complementary accents |
| `accent` | Highlights, badges, warm emphasis |
| `neutral` | Tooltips, popovers, muted chrome |
| `info` / `success` / `warning` / `error` | Status feedback (alerts, validation, delete) |

Muted text: `text-base-content/50` – `text-base-content/70` depending on hierarchy.

## Alert colors

Alerts use a **solid, fully opaque background** (the variant color) with the matching
`-content` text token. This guarantees strong contrast and a clean, professional look in
both light and dark themes without any translucency over the page:

- Container: `bg-{variant} border border-{variant} text-{variant}-content`
- Icon: `text-{variant}-content`
- `neutral`: `bg-neutral border-neutral text-neutral-content`

## Delete / destructive buttons

Use `variant="outline-error"` for outline delete actions (`border-error text-error hover:bg-error/10`). Filled destructive actions use `variant="error"`.
