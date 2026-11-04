---
status: open
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

- [ ] `layout reducer: move, resize, minimum sizes, no overlap, logical order mirrors under RTL` · pure (vitest)
- [ ] `build a board of three panels by drag and by keyboard, save, reopen; a removed view shows its placeholder` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Possible new dependency (a grid library), or a hand-rolled CSS grid. Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive builds, saves and reopens a board in en and ar.

## Blocked by

[771](771-a-boards-filters-re-ask-every-panel-and-stream-each-answer-with-the-strip-showing-n-of-n.md), [776](776-saving-my-own-item-saves-in-place-anyone-elses-saves-as-my-copy-a-clash-is-refused.md)

## Open questions

**First task, a half-day check:** can a grid library (react-grid-layout or similar) mirror under RTL, take keyboard move and resize, and pass the colour and control gates? If none passes, hand-roll on CSS grid.
