# HITL — ticket 293 (the fees carry back only when ticked)

## Q: The delivery-fee filter is `condCategory === 'F'`, but one live capture sends the category BLANK on every row — including its `DFEE` header fee. Widen the filter to the `DFEE` type as well?
**Decision taken:** No. Filtered on the category alone, exactly as spec 289 D4 wrote it, and recorded the gap as a ⚠ at the constant in `return-order.ts` for the joining ticket (295) to carry as a drift report.
**Why:** Category-only fails closed (a fee not offered is a concession not made, never money invented), and a second code that decides whether money can move is what D4/1267 refused.
**Revisit if:** the live door shows blank categories are the norm rather than one capture (`8000000121`) — then it is a BackOffice 1283 question (a real *is a header fee* flag), not a widened client filter.

## Q: Spec story 41 wants the ready summary to read *3 lines · 1 fee*. It reads *1 line* today. Extend `submitGate` here?
**Decision taken:** No. `submitGate`'s signature and its four keys are 291/292's, and 293's Proof asks only that the summary be REACHABLE with the note empty (it is). Left for 294, which owns the final submit bar.
**Why:** Pluralising two independent counts through one i18n key is a copy decision, and re-opening a settled pure function at the frontier is how two slices disagree.
**Revisit if:** 294 does not pick it up — then the fee half of the summary is silently dropped from the spec.

## Q: Column header for the fee's `condAmount` — "Rate" or "Amount"?
**Decision taken:** "Rate".
**Why:** It is what the field is (spec: "the money is `condAmount` — the rate"), and "Amount" would invite reading it as a total the client computed.
**Revisit if:** operators read "Rate" as a percentage.

## Q: The return's note is not the `add-note` action's note, but it is the same field. Duplicate the markup or parameterise `NoteField`?
**Decision taken:** Added optional `label` / `placeholder` props to `NoteField` (defaults unchanged), and passed the return's own `returnDocument.note.*` copy.
**Why:** One textarea, one set of classes; only what it asks for differs. Duplicating the markup is how two notes drift apart visually.
**Revisit if:** the return's note grows behaviour (a required flag, a length cap) the shared field should not carry.
