# HITL log: ticket 458 (retry and acknowledge mirror dead letters)

## Q: The proof line says "acknowledge for any unacknowledged row". Does that mean at least one selected row, or every selected row?
**Decision taken:** Every selected row. `deadLetterActions` offers Acknowledge only when the whole selection is unacknowledged, which is the same rule Retry has. The UI cannot build a mixed selection anyway, because acknowledged rows take no checkbox.
**Why:** A request should never carry a row the console already knows the door will refuse (`ACKNOWLEDGED`).
**Revisit if:** The owner meant "offer it whenever some row qualifies, and let the door refuse the rest".

## Q: Should acknowledged dead letters (shown under Include acknowledged) be selectable?
**Decision taken:** No. `isRowSelectable` is false for them, and `hideDisabledCheckboxes` hides the checkbox completely.
**Why:** Neither action applies to them. Retry is false by `canRetry`, and acknowledging again would come back `ACKNOWLEDGED`.
**Revisit if:** A later door adds an action for acknowledged rows, such as un-acknowledge.

## Q: When an action is not offered, should its button be hidden or disabled?
**Decision taken:** With `canOperate`, both buttons are always drawn, and each is disabled until the selection allows it (the Sync pending bar's idiom). One muted line says why Retry is withheld. Without `canOperate`, the bar is absent altogether, as ruled.
**Why:** A button that appears and disappears with every tick reads as a glitch. Absence is kept for the grant, where the ruling requires it.
**Revisit if:** A human's eye wants Retry hidden instead.

## Q: What should be re-read after an action?
**Decision taken:** The whole `storeKey(code)` prefix, which covers the Mirror tab and the header among others, plus `FLEET_KEY` and `AUDIT_KEY`. This is what `ControlDialog` does.
**Why:** The ticket names the tab and the header. The fleet's lane counts and the audit feed (the store's Audit tab) change too.
**Revisit if:** A re-read of the hours strip proves too costly. It should not, since it already polls every 30 s.

## Q: How is a refused row named in the per-row list?
**Decision taken:** As `formatPair(id, stageWord)`, for example `42 · Apply`, isolated once by `ControlResults`' `Ltr`.
**Why:** An inbox id and an outbox id can collide, so the id alone is ambiguous.
**Revisit if:** The owner prefers the stage first.

## Q: Which names do the toast and the per-row list's title use?
**Decision taken:**
- The toast uses the button's word: "Retry: done for 1 of 2 dead letters; 1 refused."
- The per-row list's title uses the audit name, as the controls' list does: "Retry mirror dead letters: refused for these dead letters".
- The audit labels are "Retry mirror dead letters", "Acknowledge mirror dead letters as lost" and "Recheck rail agreement".

**Why:** These are the existing `ControlResults` and `resultSentence` idioms, in the glossary's words.
**Revisit if:** The copy owner wants other wording.

## Q: Are any existing drive assertions changed?
**Decision taken:** None. Sections 1–7 of the controls drive run on their unchanged stubs. The new stubs (P001 on mirror, the dead-letter doors, the mirror audit rows) are opt-in options of `open()`.
**Why:** The ruling says every existing assertion stays green unchanged.
**Revisit if:** —

## Contract gap
None found. The model's `DeadLetterActionRequest` and `DeadLetterActionResponse` (from 456) match 2569 field for field. The drive cannot reach `PULL_STAGE` or `NOT_FOUND` through the UI, because Retry is never offered for a pull row. Both are covered by the vitest labels instead.
