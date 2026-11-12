---
status: done
spec: 819
blocked-by: 829
---

# 831 — The designer's tutorial builds the acceptance case, ticking itself

## What to build

A "Tutorial" action in the designer opens a checklist at the top of the inspector (798 item 4). It starts from a blank report and builds the acceptance case. **Each step ticks itself from the report's own state**: the period defaults to yesterday, a section exists, a channel bar exists, HungerStation and QC series exist, a cancellation-rate panel exists, a text holds a live figure, and so on.

"Load the finished report" is the way out. The last step is "Or ask the copilot", which shows the acceptance sentence. Before 832 lands it is shown only as text.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

store/logic (the steps as pure checks over the report) · component (the checklist) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `tutorial checks` — each step's check is false on a blank report and true on the 798 sample report · pure
- [ ] drive: follow the tutorial step by step in en and ar, watching each tick; "Load the finished report" ticks every step · flow

## Boundaries

New `boards` keys for the tutorial copy, in English and Arabic.

## Done when

The pure test is green and the drive completes the tutorial both ways.

## Blocked by

[829](829-the-designer-edits-every-block.md)

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
