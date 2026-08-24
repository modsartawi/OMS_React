# HITL log — ticket 291 (the return dialog's line grid)

## Q: AG Grid or a plain HTML table for the line grid?

**Decision taken:** A plain `<table>` inside `Modal`, not `AgGridReact`.
**Why:** 1270's approved build target — which the ticket says to build against — draws it as a
plain table; every cell is an interactive control rather than a value, so a column-def grid would be
cell renderers all the way down; and AG Grid virtualises rows, which would undermine the drive
assertion that a fully-returned line is *absent from the DOM*.
**Revisit if:** a delivery can carry enough returnable lines that virtualisation matters, or 293's
fee grid turns out to want AG Grid (the two are stacked and should read as one family).

## Q: Is a typed quantity truncated to a whole number?

**Decision taken:** No. `clampReturnQuantity` clamps into `[1, remaining]` and does not round or
truncate.
**Why:** the spec only ever states the range. `remaining` can be fractional (`items.ts` notes
quantities are "whole or fractional packs"), so truncating would silently make part of a returnable
line unreturnable — inventing a rule neither spec carries.
**Revisit if:** BackOffice spec 1283 §2 turns out to require an integer `quantity`, which ticket
295's live call would report as a `400`.

## Q: When does a typed quantity get clamped — per keystroke or on blur?

**Decision taken:** On blur, exactly as the build target does it (`draft` string in state, `quantity`
the clamped number the gate reads).
**Why:** clamping per keystroke rewrites the value under the caret — typing `12` on a cap of 4
becomes `4` after the first character and the operator can never reach a two-digit number. A cleared
box also has to be *representable* for the gate's quantity sentence to have anything to name.
**Revisit if:** an operator reports the clamp arriving too late to be understood.

## Q: What does an unticked row show in the Line value column?

**Decision taken:** Nothing — an empty cell. The build target draws an em dash there.
**Why:** `fields.test.ts` asserts this screen family "never renders an em dash" as a placeholder, and
that repo position outranks a typographic detail of the target.
**Revisit if:** the empty cell reads as a rendering failure rather than as "not selected".

## Q: What does the submit gate say once 291's two checks pass, given 292 owns the third?

**Decision taken:** It flips to the summary (`returnDocument.gate.summary`, `{ count }`); 292 inserts
*choose what happens to the goods* between the quantity sentence and the summary.
**Why:** spec 289 D3 names summary as the gate's terminal outcome, so building it now is
transcription rather than invention, and 292's insertion is one branch in the existing order. The
submit button is disabled by construction in this slice regardless of the gate.
**Revisit if:** 292 finds the summary and the reason sentence competing for the same strip.

## Q: Fee count in the summary (`3 lines · 1 fee`)?

**Decision taken:** Lines only for now.
**Why:** the fee grid is ticket 293; a fee clause with no fees to count would be dead copy.
**Revisit if:** 293 changes the summary key's shape rather than adding a parameter to it.

## Q: Is a `deleted` (struck) line returnable, and how is a line delivered in no quantity counted?

**Decision taken:** Neither is offered. `returnableLines` gained a second tally,
`notReturnableCount`, and the grid header states it as its own clause beside the hidden count.
**Why:** a line struck from the delivery is not goods a customer can send back, and folding either
case into `hiddenCount` would make the grid header — and the command's *everything has already been
returned* tooltip — state something that never happened. Neither spec 289 nor 290 mentions struck
lines; offering one is the money-moving direction, so the projection fails closed on it.
**Revisit if:** BackOffice spec 1283 rules that the server itself already excludes struck lines from
the delivery model, in which case the tally is dead code rather than wrong.

## Q: `canReturn: true` with an empty projection — the dialog's dead end.

**Decision taken:** Left as-is: the body says nothing is still returnable and the footer keeps
naming the lines sentence.
**Why:** the server folds "anything left" into `canReturn` (1283 §2b), so the state is impossible by
contract; it becomes reachable only if the returned-quantity field turns out to carry *remaining*
instead — which is exactly the drift ticket 295 exists to detect, and correcting it in the
transcription first is forbidden.
**Revisit if:** 295's live call confirms the field's sense is inverted.

## Q: D9 says `unitPrice`, `discount` and `vatAmount` are displayed read-only; the grid shows only unit price and line value.

**Decision taken:** Unit price and line value only.
**Why:** ticket 291 names exactly those two — *"Unit price and a per-line value for the quantity
selected are shown read-only, as context"* — and 1270's build target draws exactly those eight
columns. Spec 289 says the artifact is the picture where the two disagree.
**Revisit if:** an operator needs the per-line discount or VAT to decide, in which case they are two
more read-only columns and nothing else changes.

## Q: Does the stepper step from the committed quantity or from what is currently in the box?

**Decision taken:** From the committed quantity, as the build target does (the box's draft commits
on blur).
**Why:** the two only diverge while a box is mid-edit and unblurred, and reading a half-typed string
as a number is how a stepper starts stepping from `1` on the way to `12`.
**Revisit if:** the drive or an operator finds the stale-value step surprising in practice.
