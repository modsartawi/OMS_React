---
status: in-progress
spec: BackOffice 3432 (3408 §B/§C amended)
blocked-by: none (stubbed until BackOffice 3432 is on the local rig)
---

# 837 — Preview a board before saving, drag views onto it, and organise the analytics home

## Why

The owner spent two hours building boards and reports with the copilot (2026-11-07) and asked for four things:

1. **"A preview button, then back to design."** Every design should be seen as it will look before it is saved. The
   report designer has Preview (story 95); the board editor has none, and its grid shows panel names, not charts.
2. **"Compose a board from existing views by drag and drop."** Today the board editor offers one `<select>` of every view.
3. **"I see a ton of views; can we organise things?"** They want:
   - folders to drag items into;
   - chips for Mine, Certified ("standard") and Shared with me;
   - a search by date.
4. **"Are we protecting a view from delete when boards use it?"** No (see BackOffice 3432).

## What to build

1. **Board Preview.**
   - "Preview" in the board editor's toolbar swaps the editor for the board exactly as a viewer sees it: the real
     panels, charts, filter strip and cross-filter. It is built from the UNSAVED working copy (`inline` context: each
     panel asks with its view's definition plus the draft's params and bindings).
   - "Back to design" returns with nothing lost: layout, parameters, selection and the AI undo step are all kept.
   - Preview works for a new board, and for one with unsaved changes.
2. **Views palette in the board editor.**
   - A side list of every view I can read, with search, the same Mine / Certified / Shared-with-me chips, and my folders.
   - Each row shows its chart type icon and owner.
   - Drag a row onto the grid to place it at the drop cell. Or press "+" (or Enter on the row) to add it at the end.
   - It replaces the `<select>` (the `ViewPicker` stays for the report designer).
   - Dropping shows the target cell outline while dragging.
3. **Analytics home: a library.**
   - **Folder rail at the start side:** All items · Unfiled · my folders (with counts) · "+ New folder" · Recently deleted.
     - Drag a row onto a folder to file it. A row's "Move to folder" menu does the same without a mouse.
     - Rename and delete a folder from its menu (delete unfiles its items).
   - **Chips:**
     - who: All · Mine · Certified · Shared with me (Shared and not mine);
     - kind: Views · Boards · Reports;
     - changed: Any time · Today · Last 7 days · Last 30 days · a from/to range.
   - The search, chips and folder all narrow at once, client-side; the server is asked with the same params (3432).
   - The choices are kept in the URL, so a refresh or the back button keeps them.
   - Recently deleted lists my deleted items (30 days), each with Restore.
4. **Safe delete.**
   - The delete prompt on a view first asks `UsedBy` and names the boards that use it.
   - When the server refuses with `ANALYTICS-416`, the prompt lists the boards that block it (and "n more you can't
     open") and says to copy the view or ask the board's owner. Delete is not offered.

## Proof

- [ ] pure: library filters (who/kind/changed/folder/search), URL round trip, palette drop → layout cell · unit
- [ ] stub drive: preview and back keeps the draft; drag a view onto the grid; file an item into a folder; a 416 delete
      lists the boards · flow (stub)
- [ ] live on the local rig against BackOffice 3432 · flow (live)

## Boundaries

- Folders are personal and never shared; the copilot never files, deletes or restores.
