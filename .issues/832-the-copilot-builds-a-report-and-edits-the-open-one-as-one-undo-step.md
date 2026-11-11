---
status: done
spec: 819
blocked-by: 828
---

# 832 — The copilot builds a report that opens in the designer, and edits the open report as one undo step

## What to build

The copilot side of 802 (spec 819 §D):
- **The answer:**
  - `reportRefs[] { id, revision, title{en,ar} }` render as "Open in designer";
  - the assumptions render as a list;
  - the new trace labels are "Building a report" and "Editing the report";
  - absent fields read as empty;
  - the demo's `reportRefs` shape is retired.
- **The report-in-context bridge** is a small store in `core`, beside the copilot panel opener. The open designer publishes `{ reportId, revision, draft }` and clears it on close, and the copilot sends it as `reportContext` on Ask.
- **An answer's `reportEdit`** is posted back through the bridge. The designer applies it as **one history step**, labelled "AI: <the request>", and never saves it.
- **Neither feature imports the other**, which the boundary lint holds.
- **Gating:** the report tools are offered only with `canAuthor` (822 gates the ask box).

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

model (copilot answer + Ask body) · store/logic (answer parse, core bridge) · component (copilot refs, designer apply) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `answer parse` — `reportRefs`, `reportEdit`, the assumptions and the two trace labels; absent fields read as empty · pure
- [ ] `bridge` — publish, read and clear the context; a posted edit reaches only the matching `reportId` · pure
- [ ] drive: ask the acceptance sentence (stubbed `create_report`), open in the designer, ask "add the cancellation rate as a bar" (stubbed `reportEdit`), see one labelled step, undo it · flow (extends `copilot-drive`)

## Boundaries

Proposed Ask body `reportContext`, and answer fields `reportRefs` and `reportEdit`. New `copilot` keys (trace labels, Open in designer) and `boards` keys (the AI step label). Boundary lint: copilot ↛ analytics.

## Done when

The pure tests are green and the drive shows a copilot-built report opened and edited as one undoable step.

## Blocked by

[828](828-an-author-builds-a-reports-structure-in-the-designer.md)

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
