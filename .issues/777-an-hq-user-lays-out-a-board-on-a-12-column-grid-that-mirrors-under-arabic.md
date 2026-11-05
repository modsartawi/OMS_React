---
status: done
spec: 766
blocked-by: 771, 776
---

# 777 — An HQ user lays out a board on a 12-column grid that mirrors under Arabic

## What to build

The board editor at `/analytics/board/:id/edit` and `/analytics/new?kind=board`:
- drag and resize panels, with keyboard move and resize and a minimum size per chart type;
- add a panel from a view (mine, Shared or Certified) linked by reference, or build a new one with
  775's editor, saved as a view;
- text and section-header panels;
- set the board's filters, each panel's opt-outs, and a default refresh interval;
- a referenced view that was deleted shows a "view removed" panel and never breaks the board;
- saving follows 776.

## Spine reach

store/logic (layout reducer) · component/route (editor) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `layout reducer: move, resize, minimum sizes, no overlap, logical order mirrors under RTL` · pure (vitest)
- [x] `build a board of three panels by drag and by keyboard, save, reopen; a removed view shows its placeholder` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Possible new dependency (a grid library), or a hand-rolled CSS grid. Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive builds, saves and reopens a board in en and ar.

## Blocked by

[771](771-a-boards-filters-re-ask-every-panel-and-stream-each-answer-with-the-strip-showing-n-of-n.md), [776](776-saving-my-own-item-saves-in-place-anyone-elses-saves-as-my-copy-a-clash-is-refused.md)

## Open questions

**First task, a half-day check:** can a grid library (react-grid-layout or similar) mirror under RTL, take keyboard move and resize, and pass the colour and control gates? If none passes, hand-roll on CSS grid.

**Verdict (2026-11-05): no library passes; the grid is hand-rolled on CSS grid** (`boards/layout.ts` +
`boards/BoardEditorGrid.tsx`, no new dependency).

- **react-grid-layout 2.3.0** (current): places items with `transform`/`left` from the physical left, with no
  RTL option, and has no keyboard move or resize (react-draggable/react-resizable are pointer-only). Fails
  "mirrors under RTL" and "keyboard move and resize". Its `css/styles.css` also carries colour literals
  (`background: red` on the placeholder) that would need overriding with tokens.
- **gridstack 14.1.0** (current): has `rtl: 'auto'`, but its keyboard handling is only Escape (cancel) and
  `r` (rotate) during a pointer drag, so there is no keyboard move or resize. It drives the DOM imperatively (it
  moves nodes React owns) and its CSS carries colour literals (`rgba(0,0,0,.1)`, `%23666` in an inline SVG).
  Fails "keyboard move and resize".
- **Hand-rolled:** the 12 columns are LOGICAL CSS grid columns (`grid-column: x+1 / span w`), so the browser
  mirrors the board under `dir="rtl"` with no code of its own. Pointer columns are counted from the inline-start
  edge (`cellAt`), the arrow keys mirror (`keyAction`), and every control is `core/ui` (`IconButton`, `Chip`,
  `Input`, `Textarea`, `Select`), so the colour, contrast and control gates pass unchanged.

**Rulings (⚠, BackOffice 3378 to confirm):** the board definition gains `refresh` (seconds; absent = Off), beside
771's `panels` and `filters`. Moving a panel onto another pushes it down (no upward compaction, so a board may keep
gaps). Minimum sizes: KPI 2×2; bar, line, area, table and heatmap 4×3; donut 3×3; combo 4×4; text 2×1; section
header 3×1. The editor's row unit is a fixed 5rem.

## Outcome

Built on `impl/766-777`. `layout.test.ts` (20 cases) and the `777` drive (57 checks, en and ar) are green:
three panels by picker, drag and keyboard; save posts one board; the board page draws the panels where the editor
put them; Edit reopens them and saves in place; a deleted view shows "view removed" on the page and in the
editor; "Build a new view" saves a view through 775's editor in a dialog and links it.
