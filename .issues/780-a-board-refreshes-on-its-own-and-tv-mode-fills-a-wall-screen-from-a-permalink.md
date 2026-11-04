---
status: open
spec: 766
blocked-by: 773
---

# 780 — A board refreshes on its own, and TV mode fills a wall screen from a permalink

## What to build

- **Auto-refresh:**
  - a picker offering Off, 30 s, 1 min, 5 min and 15 min. The board's saved default applies, and a
    viewer's change lasts for their session only;
  - one loop per board, staggered across the panels;
  - paused while the tab is hidden, catching up on return;
  - the 30 s floor is config, provisional on 750.
- **TV mode** (`tv=1`): hides the shell, panels fill the screen, the filters become a read-only chip
  strip, cross-filter and panel actions still work, and Esc exits. A permalink with `tv=1` and
  `refresh=` opens straight into it. It still needs a signed-in session.

## Spine reach

store/logic (refresh schedule) · component/route (TV mode) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `refresh schedule: staggered offsets per panel, nothing while hidden, one catch-up on visible, floor from config` · pure (vitest)
- [ ] `a tv=1&refresh=30s permalink opens fullscreen and re-asks on the interval; Esc exits` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive proves the refresh loop and TV mode.

## Blocked by

[773](773-every-panel-offers-fullscreen-refresh-table-csv-xlsx-png-and-a-permalink-and-shows-its-freshness-and-its-failu.md)
