---
status: done
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

- [x] `dmsco-theme-drive` on the Deliveries list: toolbar buttons are pills; icon buttons carry names; lens chips expose pressed/selected state; disabled-with-reason stays focusable · flow (Playwright)
- [x] Deliveries list drives green unchanged · flow (Playwright)

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **No i18n,** unless an icon button on the Deliveries list lacked a name.
- **Typecheck must stay green across the app:** existing `Button` callers compile unchanged.

## Done when

The Deliveries list runs on Button / IconButton / Chip, its drives stay green, and the theme drive asserts the new controls.

## Blocked by

[591](591-the-app-wears-the-dmsco-palette-in-light-and-dark.md)

## Comments

**Built 2026-10-26 (impl/590-594).**

- **API.** The three controls are styled once in `src/core/ui/control-classes.ts` (pure; vitest
  `control-classes.test.ts`, 12 tests) and rendered by `Button.tsx`, the new `IconButton.tsx` and `Chip.tsx`.
  - `Button`: the nine variants keep their meaning and are now full pills (`h-7 rounded-full px-3`).
    **A new `link` variant** (underlined primary ink, h-7, no ground) rather than restyling `text`:
    `text` has 139 call sites, nearly all dialog-footer Cancel/Back/Clear, which don't navigate.
  - `IconButton`: `label: string` is required by the type (→ `aria-label`, and `title` unless one is
    passed); variants `ghost` / `outlined` / `danger`, sizes `default` (h-7 square) / `compact` (h-5);
    `aria-pressed` lights the glyph; `aria-disabled` styled like `disabled`, stays focusable.
  - `Chip`: `on` + `variant` `toggle` (`aria-pressed`) or `tab` (`role="tab"`, `aria-selected`). The
    on/off look is keyed off that attribute (`aria-pressed:` / `aria-selected:` utilities), so look and
    state cannot disagree.
- **Deliveries list.** Toolbar Open Order / Open Delivery / Columns / Export → `Button outlined`; Open
  Order / Delivery are now disabled **with a reason** (`aria-disabled` + `title`, existing keys
  `inspector.act.noRow` / `inspector.noDeliveryNo` — no new i18n). Columns-chooser pin → `IconButton
  compact`. Inspector toggle → `Chip`. Lens rows → toggle `Chip`s; they keep `aria-current` (the list
  drive reads it) and the 3px cursor bar (`CursorBar edge="-start-px"` so it still sits on the bordered
  chip's outer edge); the lens list gap went 1px → 4px so bordered chips don't touch.
- **Results.** Theme drive 174/174 (591's 108 + the new `deliveries-controls` screen, 66, ×light/dark/rtl);
  `deliveries-list-drive` 362/362 unchanged; typecheck clean; lint 4/4; vitest 6575/6575.
- **Snags / open.** (1) The lens rail now reads as a stack of bordered pills while My views rows below
  stay quiet rail rows — the ticket scoped only the lenses; owner may want My views on the same look
  (its own ticket) or the lenses back to borderless rows. (2) A lens chip carries both `aria-pressed` and
  `aria-current`; a screen reader hears "pressed, current". Dropping `aria-current` means editing the
  list drive. (3) `screen1-smoke.mjs` was not run (hard-wired to :5199 and a live API); with
  `aria-disabled` it should still read Open Order as disabled (Playwright honours `aria-disabled`).
  (4) No `cn`/tailwind-merge: a caller `className` appends and can't reliably override a same-property
  base utility — use a variant/size instead (handoff note spells it out).
