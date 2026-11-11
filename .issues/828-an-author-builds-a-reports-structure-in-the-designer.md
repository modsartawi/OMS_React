---
status: done
spec: 819
blocked-by: 827
---

# 828 — An author builds a report's structure in the designer: outline, page, inspector, undo/redo, drag and drop, keyboard moves

## What to build

`/analytics/new?kind=report` and `/analytics/report/:id/edit` open **designer D** (798):
- **the outline** on the start side: the parameters, then the section tree. It is sticky and selectable, and sections and blocks drag;
- **the page** in the middle: the editable title and strip, a toolbar on each section and block (grip, edit, up, down, remove), and "Add to this section";
- **the inspector** on the end side: sticky, never a modal, holding the section editor (heading in English and Arabic, remove).

**The history** is a pure reducer `{ past, present, future }`:
- capped at 100 steps;
- typing in one field is one step while the same key is edited within 1.5 s;
- Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z, plus buttons;
- "Removed … · Undo" for every removal, and no confirm dialogs.

**Drag and drop** is native HTML5. The grip is the draggable and the item is the drag image. The top or bottom half of the target picks the side, and a drop line shows where it lands. Blocks may cross sections. Each drop is one step, and up and down cover the same moves from the keyboard.

**Save** creates the report as Personal or saves in place, through v1's tier rules (403 copy, 405 conflict) and the 411 list. Preview shows the runner's page.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

store/logic (history reducer, reorder ops) · component/route (designer frame, two routes) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `history reducer` — apply, undo and redo; the 100 cap; coalescing by key within 1.5 s; a new edit clears redo; a removal's undo restores the exact position · pure
- [ ] `reorder ops` — move a block within and across sections, move a section, and the half-side rule · pure
- [ ] drive: add three sections, drag one to the top, remove a section and undo it, redo, save; Ctrl+Z / Ctrl+Y work; the viewport is tall enough that the drag never scrolls · flow

## Boundaries

Item create and save with `kind: report`. Two new routes. New `boards` keys (outline, inspector, history, tools). Controls are `core/ui` only, and the control baseline for `boards` does not grow.

## Done when

The pure tests are green and the drive builds, reorders, removes, undoes and saves a report's sections.

## Blocked by

[827](827-a-runner-opens-a-report-with-live-figures-and-its-summary.md)

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
