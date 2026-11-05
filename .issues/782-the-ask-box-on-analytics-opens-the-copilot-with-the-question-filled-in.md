---
status: done
spec: 766
blocked-by: 767, 781
---

# 782 — The ask box on /analytics opens the copilot with the question filled in

## What to build

- **The prefactor:** the copilot panel's open state lives only inside the top-bar button
  (`layout`). Move it into a small core store that can be opened with a question, and keep the
  button working unchanged.
- **The ask box:** an ask box on `/analytics` (home and board) opens the same panel with the
  question filled in and sent. It is gated by the copilot probe (`canAsk`) and hidden without it.
  There is never a second Ask client.

## Spine reach

store/logic (core panel-opener store) · component (ask box; top-bar button rewired) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `panel opener: open(question) opens and hands the question over once; a plain open carries none` · pure (vitest)
- [x] `asking from /analytics opens the copilot with the question sent; the top-bar button still opens it empty` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Touches `layout` (the button) and `core` (the opener). The analytics feature never imports the copilot feature.

## Done when

The drive proves both ways in.

## Blocked by

[767](767-an-analytics-view-opens-at-analytics-view-id-and-draws-its-bar-chart-behind-the-analytics-probe.md), [781](781-a-copilot-answer-that-created-a-view-links-to-it-and-the-trace-names-the-analytics-steps.md)

## Done

- `src/core/copilot-panel.ts` (+ test): the opener store — `openPanel(question?)`, `takeQuestion()` once,
  `close()`, and `available` (the top-bar button publishes `canAsk` there; false closes and drops).
- `layout/CopilotButton.tsx` reads/writes the store; `CopilotPanel` takes a handed question and sends it
  through its own conversation (or leaves it in its box when it can't be sent now).
- `features/analytics/boards/AskBox.tsx`: self-contained, gated on `available`; mounted in the home's
  `data-analytics-home-header` row. The board page (771) mounts the same component.
- Drive: `DRIVE_ONLY=782` in `tools/analytics-drive.mjs` (ltr click, rtl Enter; denied/absent hide it).
