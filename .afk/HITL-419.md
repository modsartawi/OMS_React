# HITL — ticket 419 (Tested and Back to Planned)

## Q: MarkTested / BackToPlanned bodies say `{ number }`, but the shipped Activate/Deactivate/Delete take `{ bbyNumber }` — which is right?
**Decision taken:** Sent exactly what spec 2396 writes: `{ number, note }` and `{ number }` (`BbyMarkTestedRequest` / `BbyBackToPlannedRequest` in `src/core/models/bonus-buy-maintenance.ts`, one function each in `api.ts`). Not "fixed" to `bbyNumber`.
**Why:** The wave ruling: build against the spec's reading, keep the shape in one place, flag it.
**Revisit if:** BackOffice 2397/2398 ship `bbyNumber` (question for those tickets). Change the two model types and their two api.ts call sites; the drive's steps 29/32 assert the keys.

## Q: Where do `testedBy` / `testedAt` / `testNote` sit on the wire?
**Decision taken:** Top-level on `BbyBonusBuyDocument` (beside `changedBy`/`changedAt`) and on each `BbyOverviewRow`, as one shared optional `BbyTestMark` type. All optional/nullable, so a server without them reads as "untested".
**Why:** The spec says GET BonusBuy/{n} and Promotion overview rows "add" them, without naming the nesting.
**Revisit if:** BackOffice 2397 nests them (for example under `bonusBuy` or a `testMark` object).

## Q: What does a successful MarkTested / BackToPlanned answer carry?
**Decision taken:** Read through the existing `classifyOutcome`: `refused` and `notFound` are in-band refusals shown as-is (EN + AR through `ActReport`), and anything else counts as done. On done, the bonus buy, the promotion and the list are read again.
**Why:** The spec says "BbyMaintainOutcome (in-band)" without naming the success status.
**Revisit if:** The server answers success with a status that should not count as done.

## Q: Is a blank note sent as `""` or `null`?
**Decision taken:** Trimmed; blank is sent as `null`. The note textarea has `maxLength` 200 (`TEST_NOTE_MAX`, matching `BbyTestMark.Note NVARCHAR(200)`).
**Why:** The note is optional, and a typed note is not a pasted list (the 420 truncation trap does not apply).
**Revisit if:** BackOffice wants `""`, or widens the column.

## Q: Are Mark Tested and Back to Planned offered on the editor only, or on the overview too?
**Decision taken:** Editor only (Change and Display modes alike, since they are status acts, not edits). The overview gets the Tested label, the tested by/at/note columns, and Activate gating.
**Why:** The ticket's file name and title put the acts "on the bonus buy editor", so this is the narrowest reading.
**Revisit if:** The owner wants a row action on the overview.

## Q: Should Mark Tested be possible while the Change form holds unsaved edits?
**Decision taken:** No. It is disabled with a hint ("Save your changes first…") while `formChanged(opened, state)` is true. This came from a /code-review finding.
**Why:** The server marks the saved version; the tester must not attest a version other than the one on screen.
**Revisit if:** The owner prefers an auto-save or a confirm.

## Q: How is Activate "not offered" on a Planned bonus buy in the overview?
**Decision taken:** Disabled (not hidden) whenever the selection holds a Planned row, with the title hint "A Planned bonus buy must be tested before it can be activated." An `unknown` status is left to the server. The promotion-level Activate stays offered; its refusal lists untested bonus buys through the existing `bonusBuys[]` → ActReport path.
**Why:** This follows the screen's existing pattern (disabled + title for needOne/needSome), and SAP keeps its toolbar fixed.
**Revisit if:** The owner wants the hint visible inline, since a title on a disabled button does not show on touch devices.

## Q: What colour does Tested take?
**Decision taken:** `go` (primary tint): ready to go live. Activated stays `ok`, Planned `warn`, and Deactivated/unknown `mute`.
**Why:** Tested is neither live nor waiting on its author.
**Revisit if:** The owner wants it distinct from another `go` use.

## Q: Copy that reversed 2374 in strings outside 419's sub-trees
**Decision taken:** Reworded `promotion.confirmActivateBody` and `promotion.activated` from "every Planned bonus buy" to "every Tested bonus buy". Reworded `overview.confirmDeleteBody` to "Only a Planned or Deactivated bonus buy can be deleted" (spec story 22). Updated CONTEXT.md's **BBY status** entry.
**Why:** The 2374 wording is now false.
**Revisit if:** —

## Outstanding (not AFK-able)
- Owner walk: Planned → Mark Tested (as a second user) → Activate → Back to Planned on a dev SIS.Api carrying BackOffice 2397 and 2398 (both OPEN).
