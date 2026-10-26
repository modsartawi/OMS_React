---
status: open
spec: 590
blocked-by: 591
---

# 594 — Buttons are pills, and icon buttons and chips are shared

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Expand.** The button side of 588's mixed plan.

- **`Button`:**
  - Its base takes the pill shape at the current h-7.
  - It gains a **link** look (underlined, primary ink) for text-style actions that navigate. Add
    a `link` variant, or restyle `text` if nothing relies on its current look; decide from its
    call sites.
  - All nine existing variants keep their meaning.
- **`IconButton`** (new, shared UI layer):
  - Square at h-7, with the same hover, focus and disabled treatment as the Button.
  - An accessible name is **required by its type.**
  - It keeps the disabled-with-a-reason behaviour: `aria-disabled` stays focusable.
- **`Chip`** (new): a toggle with `aria-pressed`, and a `tab` variant (`role="tab"`,
  `aria-selected`) for tab bars. "On" is the primary-050 ground with primary-800 ink and the
  primary border; "off" is the card ground with the border.
- **Proven on one screen:** the Deliveries list toolbar and its lens rail move onto these
  controls.

## Spine reach

component (shared UI: Button, IconButton, Chip) · component/route (Deliveries list) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `dmsco-theme-drive` on the Deliveries list: toolbar buttons are pills; icon buttons carry names; lens chips expose pressed/selected state; disabled-with-reason stays focusable · flow (Playwright)
- [ ] Deliveries list drives green unchanged · flow (Playwright)

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **No i18n,** unless an icon button on the Deliveries list lacked a name.
- **Typecheck must stay green across the app:** existing `Button` callers compile unchanged.

## Done when

The Deliveries list runs on Button / IconButton / Chip, its drives stay green, and the theme drive asserts the new controls.

## Blocked by

[591](591-the-app-wears-the-dmsco-palette-in-light-and-dark.md)
