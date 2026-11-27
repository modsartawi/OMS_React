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

- [x] `eachStepReadsItsOwnAnswer`: fixtures for an empty, a half-done and a ready order give the expected rail · pure
- [x] `theChecklistAndPlaceOrderAgree`: every server blocker code maps to exactly one checklist row, and an unknown code still blocks with `blockers.unknown` · pure
- [x] Drive: at 1366 and at 1024 wide there is no sideways scroll, the columns stack below 1280, and a step click focuses its section · flow

## Boundaries

No wire change. The header chips' sections (175 §9) still open in the centre column; this ticket only moves where they live.

## Done when

The console renders in three columns with the rail and the checklist, the drive is green, and the owner has looked at it on the walk set-up.

## Comments

**2026-11-27: built on branch `t/984`. The live walk is still owed.**

Built:
- `step-rail.ts` (pure):
  - `beforeYouPlace(state)` turns the server's `submitBlockers` into checklist rows: caller · items · address · store · slot · source. The reference, placed and unknown rows appear only while they block.
  - `stepRail(state)` reads the five steps from those same rows, so Review is green exactly when the checklist is `ready`.
  - Each known code maps to one row, in the receipt's own `blockers.*` words. An unknown code becomes a `blockers.unknown` row that blocks.
- `StepRail.tsx` sits at the top of the order column. Clicking a step moves focus to its section:
  - caller → `cc-phone`
  - items → `cc-item-search`
  - fulfilment → the first missing word in the sentence (for example the address)
  - payment → the payment word
  - review → the checklist
- `ConsoleShell` layout:
  - From 1280 up there are three columns: caller (288px) · order · summary (320px). Below 1280 they stack as caller → order → summary, and the console scrolls as one column.
  - The caller bar moved into the caller column. 989 fills the rest of that column.
  - *Before you place it* sits under the receipt total. It replaces the one-line "needed" sentence, so `data-cc-blockers` is gone.
  - *Place order* is disabled while any blocker remains, in addition to `canSubmit`. It has no chord.
- i18n: en and ar keys under `rail.*` and `checklist.*`.
- `CallerBar`: the lookup form can now shrink, so its search button is not clipped in the narrow column.

Proof:
- `step-rail.test.ts`: 12/12.
- `tools/callcenter-rail-drive.mjs`: 100/100. It runs at 1366, 1280 and 1024 LTR and at 1366 RTL, on an opened order and a ready order. The ready order is fixture 02 with a stubbed address and slot.
- `callcenter-shell-drive.mjs`: still 123/123.
- typecheck, `npm test` and lint: clean.

Judgement calls, and what is owed:
- The header sentence stays in the order column under the rail, because the header chips' sections still open there (see Boundaries).
- The opening-steps card (175) also stays until the gate opens. It now partly repeats the rail. A later slice can retire it if the owner agrees.
- The location link stays under the sentence. D10 moves it to the caller column (989).
- Older drives that assert the previous layout need retargeting:
  - `callcenter-callerbar-drive` and `callcenter-drive` expect the caller bar as the centre column's first child.
  - `callcenter-drive` also reads `[data-cc-blockers]` text.
- The owner has not yet looked at it on the walk set-up (Done when), so the status stays open.
