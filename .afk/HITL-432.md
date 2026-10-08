# HITL log — ticket 432 (Donor request inspector)

## Q: The pane's resize handle lives in the Deliveries feature — copy it, or graduate it?
**Decision taken:** Graduated the pure width math (`INSPECTOR_WIDTH`, `maxInspectorWidth`, `clampInspectorWidth`, `separatorKeyWidth`) to `@/core/ui/inspector-pane.ts` and the handle to `@/core/ui/PaneSeparator.tsx` (+ `useViewportWidth`); Deliveries now imports them. Pure move, same DOM; its width tests moved to `src/core/ui/inspector-pane.test.ts`.
**Why:** feature-structure: logic two features share goes up to core, never sideways or copied.
**Revisit if:** the Deliveries drive ever regresses on its separator — it was re-run after the move: 362/362.

## Q: Is the pane's width remembered, and can it be folded?
**Decision taken:** Neither. It opens at 360 each visit (resizable 320–560, 40% viewport cap) and is always shown, with an empty prompt until a row is selected.
**Why:** The ticket asks for "resizable" only; Deliveries' remembered width / `I` fold / J-K keys are its keyboard layer, which D9's cut-down layout leaves out.
**Revisit if:** the owner wants the pane foldable or its width remembered like Deliveries'.

## Q: What extra does the pane show beyond the ticket's header-fact list?
**Decision taken:** Who did each moment (raisedBy/changedBy/lockedBy/outcomeBy, as `by <user>`) and the pick time ("Waiting 1h 20m" / "Picked in 25m", one shared `pickTimeText` with the grid's column).
**Why:** Both read from the row alone; the wait is story 11's question and the model already computed it.
**Revisit if:** the owner wants the pane limited to the ticket's list.

## Q: A TRANSFERRED request whose STO / SAP numbers are blank
**Decision taken:** The Transfer block shows once the request is transferred (a transferred time OR a TRANSFERRED state), a blank number reading "Not in yet". A request cancelled after its transfer keeps the block.
**Why:** "once transferred" in the ticket; a reversed-by-hand cancel still has an STO to trace.
**Revisit if:** the server never sends TRANSFERRED without the numbers — then the "Not in yet" text is dead.

## Q: Where does the export button sit, and what does it write?
**Decision taken:** A toolbar row above the grid; the grid as shown (its column filters and sort) through `gridSheet`/`writeWorkbook`, identities (request, delivery, both stores) as text, units as numbers. File `donor-requests-yyyyMMdd-HHmm.xlsx`.
**Why:** Same shape as Central invoices' export.
**Revisit if:** the status bar's count (all loaded rows) vs the export's (after column filters) confuses users — the gap is 431's status bar.

## Note: left as review findings, not changed
- The delivery route `/oms/delivery/<no>` is now built in three places (deliveries `inspector-model.ts`, `GridToolbar.tsx`, donor-requests `inspector.ts` — only this one URL-encodes). A `@/core/oms` route builder would end the drift; it touches Deliveries again, so it was left.
- `onCellFocused` (selection follows focus) and the Enter guard in `onCellKeyDown` are near-copies of DeliveriesPage's. Graduating them is the same kind of follow-up.
- `CONTEXT.md` defines "donor moment" as a point on the Delivery timeline only; the donor request inspector now shows them too. Glossary not edited (that is `/domain-modeling`'s).

## Note: port 5199 was occupied by a server this session did not start
The drives ran on a vite server started on port 5232 (`DRIVE_PORT=5232`), killed afterwards. The process on 5199 was left alone.
