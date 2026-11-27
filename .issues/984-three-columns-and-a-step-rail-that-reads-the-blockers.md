---
status: open
spec: 983
blocked-by: —
---

# 984: Three columns, and a step rail that reads the submit blockers

Slice of [spec 983](983-the-console-is-built-around-the-caller-spec.md). Reference picture: the
*Call Center Console v3* artifact (v3).

## What to build

The shell becomes three columns: the caller (left), the order (centre) and the summary (right). It
replaces the three header bands (D1). Above the search sits the step rail Caller · Items · Fulfilment ·
Payment · Review (D3):
- each step shows its own answer ("Home · 4–6 pm", "Cash on delivery");
- a step is green when done and amber while missing;
- clicking a step focuses its section.

The Review step and the summary's **Before you place it** checklist both come from the same pure
`step-rail.ts` over `SessionState` plus `submitBlockers(...)`. *Place order* is disabled while any
blocker remains (D9). It has no chord.

## Spine reach

component (`ConsoleShell` layout, `StepRail`) · pure (`step-rail.ts`) · i18n (`callcenter`) · test (vitest + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `eachStepReadsItsOwnAnswer`: fixtures for an empty, a half-done and a ready order give the expected rail · pure
- [ ] `theChecklistAndPlaceOrderAgree`: every server blocker code maps to exactly one checklist row, and an unknown code still blocks with `blockers.unknown` · pure
- [ ] Drive: at 1366 and at 1024 wide there is no sideways scroll, the columns stack below 1280, and a step click focuses its section · flow

## Boundaries

No wire change. The header chips' sections (175 §9) still open in the centre column; this ticket only moves where they live.

## Done when

The console renders in three columns with the rail and the checklist, the drive is green, and the owner has looked at it on the walk set-up.
