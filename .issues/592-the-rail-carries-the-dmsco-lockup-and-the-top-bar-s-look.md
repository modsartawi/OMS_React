---
status: done
spec: 590
blocked-by: 591
---

# 592 — The rail carries the DMSCO lockup and the top bar's look

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

The shell from 587, on today's sizes (56/240px rail, 32px rows, 44px top bar).

- **The mark.** A shared brand-lockup piece replaces `BrandMark` in the rail head and the phone
  drawer.
  - **Expanded:** the white DMSCO lockup, a hairline divider, then "BackOffice"
    (`common:brandName`).
  - **Collapsed:** the dotted-D symbol, cropped from the same artwork (viewBox `155 0 107 140`).
  - The lockup comes from `assets/581-figma-frames/assets/dmsco-logo-on-dark.svg` and moves into
    the app's assets. The palette gate excludes it, as it does the login lockup.
  - Its accessible name is a translation key.
- **The rail ground** is a radial deep navy, `#111A1E` → `#172031`. The two stops are new tokens.
  It covers the rail, the flyout, the overlaid tree and the drawer, through the rail popover recipe.
- **The active item** is a filled `#182F4A` pill with a gold icon and a faint white inset hairline.
  It replaces the 3px gold `::before` bar everywhere it is drawn. `aria-current` logic is
  unchanged.
- **Every rail row and icon is a full pill.** Hover keeps `--rail-accent` with white ink.
- **In the top bar,** the palette field and the store chip become full pills, and the field's
  ground is `--card`.
- **New contrast pairs:**
  - both gradient stops against the rail ink, muted ink and gold;
  - the pill ground against white ink and the gold icon;
  - the hairline against the rail (non-text 3:1). If the hairline fails, drop it and lift the
    pill ground instead.

Look reference: prototype commit `d1c7915e` (its CSS writes literals; don't copy it).

## Spine reach

tokens · component/route (rail, drawer, top bar) · i18n (lockup name) · test

## Proof (→ `tdd` red-green cycles)

- [x] contrast gate green with the rail gradient + active-pill pairs · lint gate
- [x] `dmsco-theme-drive`: the rail head shows the lockup expanded and the symbol collapsed; exactly one active item, drawn as the filled pill; drawer matches; RTL mirrors · flow (Playwright)

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **One new i18n key** in `common` for the lockup's accessible name.
- `BrandMark` stays in the shared UI layer for now; 606 decides whether to delete it.
- The rail-mode behaviour and the existing rail drives are unchanged.

## Done when

The shell drive passes in all modes with the DMSCO lockup and the active pill, and the gate is green.

## Blocked by

[591](591-the-app-wears-the-dmsco-palette-in-light-and-dark.md)

## Comments

**2026-10-26 — built (branch `impl/590-592`).**

- **Landed:** `core/ui/DmscoLockup` (white lockup + divider + `common:brandName`; collapsed = the dotted-D crop,
  viewBox `155 0 107 140`) in the rail head and the drawer head; assets in `src/assets/dmsco/`, excluded by the
  palette gate; one new key `common:brandLockup`. Tokens `--rail-gradient-from #111a1e`, `--rail-gradient-to #172031`,
  `--rail-pill`; utility `bg-rail-gradient` (lit from the inline-start corner, mirrored under RTL) on the rail and
  through `RAIL_POPOVER` (flyout, overlaid tree, drawer, user menu). Active item = `--rail-pill` ground, white ink,
  gold icon; the 3px `::before` bar is gone; `aria-current` logic untouched. Every rail row/icon/toggle is
  `rounded-full`. Top bar: palette field and store chip are full pills, field on `--card`.
- **The hairline was dropped.** 587's faint white inset hairline (white 10% on `#182f4a` = `#2f445c`) measures
  1.63:1 on `--rail` (1.77:1 on the deep stop) — under the non-text 3:1. Per spec 590 the pill ground was lifted
  instead, `#182f4a` → `#234670` on the same hue; the gate holds it at ≥1.6:1 against both stops (the separation
  the hairline gave — not a WCAG floor; the state is carried by the gold icon and `aria-current`). *Owner check by
  eye: is `#234670` the right lift?*
- **Results:** contrast gate 273 pairs clean (new: 3 rail inks + white on both stops, white/gold on the pill, the
  lift, EXPECTED pins); lint 4/4; typecheck; vitest 6563/6563; `dmsco-theme-drive` 337/337 — new modes expanded ×
  {light, dark, rtl}, overlay (1100px), drawer × {light, dark, rtl}; new `rail-panels` screen (flyout, overlaid tree,
  drawer). `callcenter-shell-drive` 123/123. `foundation-drive` rail/narrow parts score the same as the integration
  tip (72/96, 94/104): its gold `::before` marker checks were already red (palette-pinned) and now describe a retired
  look — 593 should rewrite them to the pill. Its full run dies at `/oms/document/…` waiting for a
  `section[aria-label="Actions"]` that no longer exists (pre-existing).
- **Snags:** the rail head link keeps `aria-label` = `common:brand` ("al-dawaa BackOffice") — unchanged on purpose
  (story 24), but it now names a DMSCO lockup; owner may want it reworded. The Deliveries page overflows at 400px
  (scrollWidth 1268), so RTL phone screenshots look shifted; the drawer's own geometry is checked and correct.
  `BrandMark` still used by `app/HomePage.tsx` (606).
