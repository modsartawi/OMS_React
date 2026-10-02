---
status: done
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

- [x] `rail mode is pinned, overlay or drawer by width and preference` — pure · vitest
- [x] `tools/foundation-drive.mjs` (extend) at 1100px: the rail is collapsed even with the preference
  expanded, the toggle overlays without moving the grid's left edge, and navigation closes it ·
  flow (Playwright)
- [x] The same drive at 390px, in LTR and RTL: no rail, the hamburger opens the drawer with every
  granted leaf, body scroll is locked, and Esc returns focus to the hamburger · flow (Playwright)

## Boundaries

New `common:topbar.*` keys only.

## Done when

The shell behaves per 363's three width bands in the drive, in both directions.

## Blocked by

[386](386-the-top-bar-carries-crumb-store-chip-and-bell.md)

## Comments

**Done 2026-10-02.**

**What was built:**
- `layout/rail-mode.ts` is pure. `railMode(width)` returns `pinned` (≥1280), `overlay` (640–1279) or `drawer` (<640). `railExpanded(mode, preference, overlayOpen)` reads the stored preference **only** when pinned. `useRailMode()` re-reads the band on resize through `useSyncExternalStore`. 640 and 1280 are the shell's only breakpoints; the 992px one went with 385's sidebar.
- `AppShell` renders `Rail` with its mode outside the drawer band. Below 640px there is no rail, and `TopBar` leads with the hamburger.
- **640–1279px** (`Rail.tsx`):
  - The rail stays 56px.
  - Its toggle opens a transient overlay that is **never written to `oms.railExpanded`**. The aside keeps its 56px footprint while the `nav` stretches 240px over the page from the inline start, over a `--backdrop` scrim, so the grid does not move.
  - Navigation (the tree's links and the brand), Esc (focus back on the toggle) and a scrim click close it. So does crossing a band.
  - The group icons still open their flyouts.
- **<640px:** `RailDrawer` (in `Rail.tsx`, so it reuses the tree's rows) is the hamburger at the top bar's inline start.
  - It opens a navy, modal `role="dialog"` drawer portalled to `body`, holding the brand, every visible group (uppercase label) with every leaf, and the Settlement sub-group as a header plus indented leaves.
  - The user menu sits at its foot and opens above the avatar (`UserMenu` gained `placement`; `onOpen` became optional). Without it a phone could not sign out.
  - The body's overflow is locked while it is open, and the previous value is put back afterwards.
  - Tab wraps inside it, including from the open user menu.
  - Esc, a scrim click and navigation close it, and every close returns focus to the hamburger.
- **Token:** `--backdrop` (377 §1 values) and its bridge line, added here because 387 names it. 388 adds `--shadow-pop` and moves the other scrims onto it.
- **Keys:** `common:topbar.drawer.{open,label}`. The drawer's X reuses `rail.close`.

**Proof:**
- vitest `src/layout/rail-mode.test.ts`: 4 tests. It covers both sides of both edges (639/640, 1279/1280), that pinned follows the preference, that overlay ignores it, and that the drawer never draws a rail. It was red first (no module), then green. Full suite: 171 files, 3163 tests.
- `tools/foundation-drive.mjs` gained a `narrow` part (`DRIVE_ONLY=narrow`): 26 checks in each of light/dark × LTR/RTL, 104/104. The preference is stored **expanded** throughout.
  - At 1100px:
    - the rail is collapsed at 56px;
    - the toggle lays the 240px tree from the inline start, the scrim computes `--backdrop` per theme, and the rail footprint and **both grid edges** stay put;
    - the stored value stays `true` through open and close;
    - navigation, Esc (focus on "Expand menu") and a scrim click each close the overlay;
    - 1280 is pinned and expanded again, and 1279 is collapsed again.
  - At 390px:
    - there is no rail, and the hamburger sits at the top bar's inline start;
    - the drawer is a navy dialog named "Menu" at the inline start over `--backdrop`;
    - its group labels are exactly OMS and Collections, and its leaves equal **the two flyouts' own lists**, so every granted leaf is there and nothing else;
    - it carries the brand, and focus lands on the first leaf;
    - `body` overflow is hidden, and a wheel moves nothing on a page that can scroll;
    - 30 Tabs stay inside, and Tab from the open user menu stays inside;
    - the user menu opens on screen, and its Esc leaves the drawer open;
    - Esc, a scrim click and navigation close the drawer, each returning focus to the hamburger and unlocking the body;
    - no page errors.
- The whole foundation drive is **536/536**. Regression drives: `oms-access` 28/28, `central-invoice` 65/65, `central-invoice-list` 52/52, `loy-member` 184/184, `settlement` 291/291. All of these run at ≥1280px, so they are untouched by the bands.
- Gates: `npm run typecheck` is clean. `npm run lint` passes all four gates (728 files; 22 grid mounts; 148 contrast pairs, unchanged because `--backdrop` is not a text pair; 733 files). `npm run build` is green.

**Reviews:**
- `/code-review` found one bug: Tab from inside the open user menu escaped the drawer. It is fixed, and a drive check now covers it.
- `/standards-review` found no hard violation on either axis. Applied:
  - `UserMenu`'s `onOpen` became optional instead of taking a no-op;
  - one `GROUP_LABEL` class is now shared by the tree, the flyout and the drawer;
  - `TopBar`'s prop is now `withDrawer`.
- Left on purpose:
  - `RailDrawer` lives in `Rail.tsx` to share its rows. Splitting it out would mean exporting them.
  - The Esc/outside-dismiss pattern now has two more copies. That is 388's overlay recipe to fold together, as are the `shadow-lg`s, which become `--shadow-pop`.

**Decisions taken unattended:** see `.afk/HITL-387.md`. They cover:
- `--backdrop` added early;
- the user menu at the drawer's foot;
- the keys;
- the drawer modal and the overlay not;
- the toggle's wording;
- crossing a band.

**Outstanding (owner, not build blockers):**
- the S1 live sign-off at 391;
- a human eye on Arabic rendering;
- a real-device check that the body lock holds under iOS Safari touch scrolling. Chromium proves it; older iOS may not honour `overflow: hidden` on `body`.
