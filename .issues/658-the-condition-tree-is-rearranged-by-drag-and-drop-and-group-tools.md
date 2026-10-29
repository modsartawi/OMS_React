---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md); owner ask 2026-10-29
blocked-by: 657
---

# 658 — The condition tree is rearranged by drag and drop and group tools

## What to build

The owner: "If I forgot to create a group at the beginning and made other conditions, today I have to remove
everything and start over." Every editor that draws the guard language's All of / Any of tree — the guard editor's IF
(`guards/ConditionEditor`) and the category / coverage rules' (`coverage/RuleConditions`) — rearranges it in place:

- **Pure moves** in `@/core/insurance-rules/guard-edit`, by `ConditionPath`: `moveCondition(from, toParent, index)`
  (refuses a group into itself or a group under it, and a 4th group level — `moveRefusal` says which), `moveUp` /
  `moveDown`, `moveOutOfGroup`, `moveIntoGroup` (+ `groupsToMoveInto`), `wrapInGroup(paths, mode)` (sibling
  conditions → one new group at the first one's place), `ungroup`, `duplicateCondition`, and `withWhen` (the same
  rule when nothing changed, so a refused move is no history step).
- **Drag and drop**, native HTML5, no dependency (`@/core/insurance-rules/ConditionTreeTools`): a handle on every
  condition and group; drop zones between siblings, after the last and inside every group (an empty one too); a line
  where it lands; a refused drop shown as not allowed with why (into itself / three levels at most).
- **Without a mouse**: each condition's **Move…** menu (up, down, out of the group, into group n, duplicate; Ungroup
  on a group), and **Select to group**: tick siblings, then Group as All of / Any of. The All of / Any of switch is kept.
- Every move is one edit through the editor's history: Undo / Redo cover it. Words in `insurance-rules` (`tree.*`),
  EN + AR (the selected count in all six Arabic forms).

Decisions:

- **A NOT group is not ungrouped** (the menu shows "turn NOT off first"): NOT (a and b) is not (NOT a) and (NOT b), so
  ungrouping it would silently change what the rule means. An Any of group ungrouped into an All of list does join its
  conditions with AND — the author asked for that, and Reads as shows it at once.
- **Codes after a move**: a rule's codes default from its first block (K11). A move that changes the first block goes
  through `editRule` like any edit of `when`: an effect whose codes were still the old default takes the new first
  block's; codes the author typed are kept (pinned by test).

## Spine reach

ui · test

## Proof (→ `tdd` red-green cycles)

- [x] every move, including the refusals (into itself, a 4th level, a NOT group ungrouped) and a no-op move giving
      back the same conditions — `guard-tree.test.ts`; mutation-checked (dropping the into-itself refusal fails two tests)
- [x] a move is one step Undo takes back, a refused one no step; codes follow the first block only while default
- [x] `tools/insurance-guard-editor-drive.mjs` step 11 (LTR + RTL): two top-level conditions selected → Group as Any of;
      a group dropped into itself refused; a third dragged into the group; one moved out with the menu; Undo / Redo;
      a NOT group cannot be ungrouped; Ungroup; the saved `when` is the rearranged tree (158/158)
- [x] `tools/insurance-coverage-drive.mjs` unchanged (172/172); tsc, lint, the whole vitest suite green

## Boundaries

The shared pieces are core (`guard-edit`, `ConditionTreeTools`); the two editors only place them. No new hand-styled
control (the handle is not a control; the menu is core's Select, the ticks checkboxes). Rules: `feature-structure`,
`i18n-zero-literal` (EN + AR), `bidi` (the group number in a menu option is `fsi`-isolated), `logical-tailwind`.

## Done when

A condition or group moves into, out of and along any list by drag, by its menu, or by selecting and grouping, and
Undo takes each move back.
