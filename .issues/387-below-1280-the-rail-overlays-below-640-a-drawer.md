---
status: open
spec: 380
blocked-by: 386
---

# 387 — Below 1280px the rail overlays the page; below 640px it is a drawer

Step S1 (Foundation) of [spec 380](380-ops-console-rebuild-spec.md). Spec decision **F13**. The
values are in [363](363-the-rail-shell.md) §"Narrow widths". The prototype's captures are
`D-1100-light.png`, `D-1100-peek-light.png`, `phone-390.png` and `phone-390-drawer.png` in
[363-shots](assets/363-shots/).

## What to build

- **≥1280px:** as built in 385 and 386.
- **640–1279px:** the rail is **always collapsed**. The expand toggle **overlays** the labelled tree
  with a `--backdrop` scrim, so the page does not reflow. The tree closes on navigation, Esc or a
  scrim click. Today's 992px breakpoint goes.
- **<640px:** there is no rail. A hamburger at the top bar's inline start opens a **navy drawer**
  with the full labelled tree (brand, every visible group, every leaf). Body scroll locks while it
  is open. Esc, a scrim click or navigation closes it, and focus returns to the hamburger.
- The stored expand preference is **not** overwritten by the forced-collapsed state.
- **i18n:** `common:topbar.*` gets the hamburger's and the drawer's accessible labels.

## Spine reach

`layout/` shell (media-driven mode, overlay, drawer) · `common` locale · drive.

## Proof (→ `tdd` red-green cycles)

- [ ] `rail mode is pinned, overlay or drawer by width and preference` — pure · vitest
- [ ] `tools/foundation-drive.mjs` (extend) at 1100px: the rail is collapsed even with the preference
  expanded, the toggle overlays without moving the grid's left edge, and navigation closes it ·
  flow (Playwright)
- [ ] The same drive at 390px, in LTR and RTL: no rail, the hamburger opens the drawer with every
  granted leaf, body scroll is locked, and Esc returns focus to the hamburger · flow (Playwright)

## Boundaries

New `common:topbar.*` keys only.

## Done when

The shell behaves per 363's three width bands in the drive, in both directions.

## Blocked by

[386](386-the-top-bar-carries-crumb-store-chip-and-bell.md)
