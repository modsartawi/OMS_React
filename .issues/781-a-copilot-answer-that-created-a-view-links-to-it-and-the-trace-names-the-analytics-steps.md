---
status: done
spec: 766
blocked-by: —
---

# 781 — A copilot answer that created a view links to it, and the trace names the analytics steps

## What to build

In the copilot feature only:
- the D10 answer's new **`viewRefs[]`** (`{ id, title{en,ar} }`; absent is read as empty) renders
  as "Open view" links to `/analytics/view/:id`, by route string;
- the tool → label map gains "Reading the analytics model", "Running the analytics query" and
  "Saving a view", for the trace and the working state.

## Spine reach

store/logic (`answer`/`trace` modules) · component · i18n (`copilot`) · test

## Proof (→ `tdd` red-green cycles)

- [x] `answer: viewRefs become Open-view links; absent viewRefs read as empty` · pure (vitest, extends `answer.test.ts`)
- [x] `trace: the three analytics tools get plain-language labels` · pure (vitest, extends `trace.test.ts`)
- [x] `an answer with a viewRef shows Open view and routes to the view` · flow (extends `tools/copilot-drive.mjs`)

## Boundaries

Copilot feature only, plus new `copilot` keys. Wire: the additive `viewRefs` from BackOffice 3383.

## Done when

The extended copilot tests and drive are green.

## Blocked by

None — can start immediately.
