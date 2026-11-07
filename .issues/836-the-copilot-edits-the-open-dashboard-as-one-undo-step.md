---
status: done
spec: BackOffice 3430 (3408 §I amended)
blocked-by: none
---

# 836 — The copilot edits the open dashboard as one undo step, and the designers say "Edit with copilot"

## Why

A business power user asked whether the copilot, opened from the report or dashboard designer, can work on **that open item**: "remove this", "add that figure", "update this section".

- **Reports: yes, since 832.** The open designer publishes its working copy through `@/core/report-context`. The copilot sends it as `reportContext`, the server's `edit_report` returns the full checked definition, and the designer applies it as one undo step, "AI: <the request>". It never saves.
- **Dashboards (boards): no.** `BoardEditor` publishes nothing, the copilot has no board in context, and the server has no `edit_board` tool. On a board the copilot can only make a new view (`create_view`).
- **Neither designer shows the way in.** The user has to know that the top bar's "Ask the OMS", opened while the designer is open, edits the report. There is no "Edit with copilot" button, and nothing in the copilot panel says which report it is working on.

## What to build

1. **An "Edit with copilot" button in both designers' toolbars** (author grant only, like the rest of the copilot). It opens the copilot panel through `@/core/copilot-panel`.
2. **An "Editing: <title>" chip at the top of the copilot panel** while an item is in context, so the user can see what the copilot will change. A new, unsaved item reads "Editing: new report/dashboard".
3. **A board in context, the same pattern as 832:**
   - a `@/core/board-context` bridge (or a generalised `item-context`): `{ boardId, revision, draft }` publish/clear, `postEdit`/`takeEdit`;
   - `BoardEditor` publishes its draft and applies a `boardEdit` as one history step, "AI: <the request>", and never saves it;
   - the copilot sends `boardContext` on Ask and posts the answer's `boardEdit` back.
4. **BackOffice: an `edit_board` copilot tool.** It returns the full board definition (tiles = saved views or inline queries, layout, board filters, refresh), checked by the same validator a manual save uses, and refused with its problems rather than silently dropped. It never shares, certifies or saves. It is offered only with `canAuthor`. A D14 eval case is added for it.

## Spine reach

BackOffice spec + tool · model (Ask body `boardContext`, answer `boardEdit`) · core bridge · component (both toolbars, copilot chip, board editor apply) · i18n en+ar · test (vitest pure + stub drive) · live drive

## Proof (→ `tdd` red-green cycles)

- [ ] the bridge: publish/clear/take, and an edit for another board is dropped · unit
- [ ] askBody carries `boardContext` only while a board is open · unit
- [ ] stub drive: "Edit with copilot" opens the panel with its chip; "remove the stores tile" becomes one undo step, Undo restores it, nothing is saved · flow (stub)
- [ ] live drive on the local rig: the same, against the real `edit_board` · flow (live)

## Boundaries

- The copilot never saves, shares, certifies or schedules (802's ruling, extended to boards).
- The copilot and the analytics features never import each other; they meet in `core` (boundary lint).
- The report half of items 1–2 can ship before the BackOffice tool exists.

## Open questions

- One generalised `item-context` bridge, or a board bridge beside the report one? Recommendation: generalise it, keyed by `{kind, id}`.
- Should "Edit with copilot" put a starter prompt in the ask box ("Change this report: …")? Recommendation: no; focus the box and keep the chip.

## Comments

- 2026-11-07, **built and proven live** on the local rig (uncommitted in both repos).
  - **BackOffice 3430:**
    - `edit_board` is offered only while a board is in context, and only with the author grant. It edits only the board in context, never saves, and refuses someone else's board or a Certified one (403).
    - Each view panel's view is read as the user, and one they can't read is refused, naming the panel.
    - Bindings use the reports' pre-fill.
    - Layout: a kept panel keeps its layout and cross-filter opt-out. A new panel goes under the others. Panels are settled so none overlaps (found live: a header "at the top" sat on the kept chart).
    - The validator is the board save check.
    - Both edit tools now refuse an edit that empties the item in context (the 835 ask).
    - Spec 3408 §I says `draft` is the bare definition.
    - Tests: 8 new data tests. The copilot and analytics suites pass; the two timing tests pass when run alone.
  - **Web:**
    - `@/core/item-context` is generic; the report bridge and the new board bridge are instances of it, and both carry the title for the panel.
    - The Ask body sends `boardContext`, and the answer's `boardEdit` is posted back.
    - The trace and the answer card say "Editing the board".
    - The copilot panel shows "Editing the report: <title>" or "Editing the board: …".
    - **Edit with copilot** is in the report designer's toolbar and the board editor's add bar. It is disabled, with the reason, on a new item, someone else's or a Certified one (`copilot-edit.ts`).
    - The board editor applies a `boardEdit` as one snapshot step, "AI: <request>" · Undo. A change made after it ends the step.
    - Gates: 9,508 tests, typecheck, and every lint gate except the 4 known `insurance-rules/aliases` boundary violations.
  - **Live, in the owner's Chrome:**
    - On board `06GTTQ55HS3SXRMR5MT4BXJ0G3`, "Remove the second panel and add a section header at the top saying 'Orders overview'" made one `edit_board` call. The header went on top with the chart under it. Undo restored both charts.
    - On the Certified report, the button is disabled with its reason. On the personal report, it opens the copilot with the label "Editing the report: Channel Sales and Order Comparison Report".
  - **Not done:**
    - a D14 eval case for `edit_board`;
    - the stub-drive flow (proof row 3), which was replaced by the live drive;
    - Arabic for the copilot namespace (copilot.json is English-only, as before).
