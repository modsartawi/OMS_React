---
status: done
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

- [x] `refresh schedule: staggered offsets per panel, nothing while hidden, one catch-up on visible, floor from config` · pure (vitest)
- [x] `a tv=1&refresh=30s permalink opens fullscreen and re-asks on the interval; Esc exits` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive proves the refresh loop and TV mode.

## Blocked by

[773](773-every-panel-offers-fullscreen-refresh-table-csv-xlsx-png-and-a-permalink-and-shows-its-freshness-and-its-failu.md)

## As built

- Pure: `boards/refresh-schedule.ts` (+ test) — `panelOffsets` (evenly in board order), `startSchedule` / `tick` /
  `nextDueAt` (cycles on the WALL clock, so every screen on a board asks a panel at the same moment, inside the
  server's 30 s cache; nothing while hidden; one catch-up per panel on return), `refreshFloorMs` (config
  `VITE_ANALYTICS_REFRESH_FLOOR_S`, 30 unless set), `refreshChoices`, `readRefresh` (one under the floor runs at
  the floor), `boardRefresh` (permalink → this session's choice → the board's saved default → Off).
- ⚠ Wire proposal: `AnalyticsBoardDefinition.refresh` (the saved default), read by `readBoard` only as a picker value.
- `boards/BoardRefresh.tsx` — the picker, the session choice (`sessionStorage`, per board; written to `refresh=`
  too, never to the board), and the board's ONE loop (one timer armed for the next panel due). Each view panel
  hands its `refetch` to the board (`BoardPanel` `registerRefresh`); an answer on its way is not asked again.
- TV mode: `boards/TvMode.tsx` (`useTvMode`, the button, the read-only `FilterChips`). The shell honours a
  GENERIC route flag, `ShellRouteHandle.chromeless: 'tv'` (`layout/shell-route.ts` `hidesShell`, + test); the
  router sets it on `analytics/board/:id`. Layout imports nothing from the feature. Still inside ProtectedLayout.
- Ruling: a permalink can't take the browser's full screen (it needs a user gesture), so `tv=1` fills the
  WINDOW (fixed, shell hidden); the TV mode button also asks the browser for full screen, and leaving the
  browser's full screen leaves TV mode. A kiosk browser (F11 / `--kiosk`) gives the wall screen the rest.
- Drive: `DRIVE_ONLY=780` — 49/49 (ltr, rtl, refresh choice/session/saved default, anonymous → login).
