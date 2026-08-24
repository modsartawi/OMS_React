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

## Findings raised by review but OUT OF 293's scope — left for triage
Neither of the two review axes found a hard standards violation or a spec defect in 293's own diff.
The built-in `/code-review` (high) surfaced three correctness findings, **all in code 291/292 already
committed**, none in this diff. Recorded here rather than fixed, because re-opening a landed slice at
the frontier is how two sessions disagree:

1. `ReturnDialog.tsx` `pickAll` — clicking the indeterminate select-all after editing a line's
   quantity silently resets that quantity to the full remaining amount (291).
2. `PickupAddressPanel.tsx` — the code-only district fallback shows a matched district without
   running `applyPickupDistrict`, so a delivery with a blank/stale `cityCode` renders a selected
   district beside an empty City, with no one-step way to fill it; 294 would then post
   `districtCode` with `cityCode: ''` (292).
3. `commands.ts` — `documentCategory !== 'D'` yields *Open the delivery to return it.* on the capture
   `9000000003` (`documentCategory: 'T'`, opened as a delivery) — the very message the comment above
   the check warns against (290).

The standards axis also suggested extracting the fee table into a `FeeGrid.tsx`, as 292 extracted
`PickupAddressPanel`. **Decision taken:** left inline. **Why:** 294 grows this component again and an
extraction now would be re-cut against its needs. **Revisit if:** 294 lands and `ReturnDialog.tsx` is
still one file carrying four panels.

## Triage — all three fixed (2026-08-24, after the wave)

Taken in one change on `spec/289-bonded-return`, each with a test that fails without it.

1. **`pickAll` no longer refills a row already picked.** Ticking the header ADDS the
   unpicked rows and leaves every picked row's quantity alone; unticking still forgets
   every number. `return-dialog-drive` step 6 asserted the old behaviour (`4 / 4` after
   select-all) and now asserts the new one — line 10 keeps the `1` typed into it, then goes
   back to a full line through the per-row tick so step 8's value column is still read on 4.
2. **The code-only district match is reconciled into the draft.** New pure
   `reconcilePickupDistrict(address, district)` in `return-order.ts` writes exactly what
   re-picking that row would write, and returns the SAME object when the pair already
   agrees — so `PickupAddressPanel`'s effect can run every render without a loop. Five unit
   tests, plus `return-dialog-drive` step 28: a second delivery (`8000000254`) addressed to
   `D77` with a blank `cityCode` now shows *An-Nakheel · Riyadh* and posts the pair.
3. **The first return reason is read off the ROUTE, not `documentCategory`.**
   `CommandContext.documentCategory` became `openedAs: OpenedAs` (the type moved to
   `actions.ts`, beside its D-17/D-19 twin `isDeliveryCategory`, and is re-exported from
   `DocumentDetailsPage`). `9000000003` — opened as a delivery, category `T` — now gets the
   store reason instead of being told to open the delivery it is already on.
   ⚠ **Gating did not change**: `disabled` still follows `canReturn` alone, checked first.
   `document-actions-drive` reads the store and exhaustion reasons through `/oms/delivery/*`
   now, because on `/oms/document/*` "Open the delivery to return it." is the honest answer
   and would mask them.

Gates: `typecheck` ✓ · `lint` ✓ (3/3) · `build` ✓ · vitest **1978/1978** ·
`return-dialog-drive` **105/105** · `document-actions-drive` **46/46**.
Still nothing driven against a live SIS.Api, and `returnedQuantity` remains 295's question.

### Follow-up — `/standards-review` on the fix commit (2026-08-24)

Both axes reported no hard standards violation and a clean gating verdict. Two findings were real
and are fixed in the follow-up commit:

- **Spec axis: stories 4 and 5 had become route-conditional.** Keying the first reason off
  `openedAs` ALONE meant a delivery reached through `/oms/document/:documentNo` with
  `canReturn: false` reported *Open the delivery to return it.*, burying the store and exhaustion
  causes. Worse, the two `document-actions-drive` steps had been moved to the delivery route, which
  dodged the regression instead of catching it. The rule is now **both signals**: refuse only when
  `documentCategory` AND `openedAs` both say "not a delivery". Drive steps (b) and (c) read the two
  causes on the DOCUMENT route again, and `commands.test.ts` pins both halves.
- **Standards axis: dead re-export.** `export type { OpenedAs }` in `DocumentDetailsPage.tsx` had no
  consumers and its comment described callers that do not exist. Deleted.
- **Standards axis: `reconcilePickupDistrict` re-spelled `applyPickupDistrict`'s write-set** in its
  identity check, so a fifth field added there would silently stop being reconciled with no test
  failing. It now shallow-compares every field.

Spec 289 D2 carries an addendum recording the two-field rule, and ticket 290's table is marked
superseded — the spec is corrected first, which is this wave's own posture.

Left as judgement calls: the effect could be a render-phase `setState` (one less paint);
`openDelivery` duplicates `open`; drive step 6 tests two rules and repairs its own state; the
comments say "collection" where CONTEXT.md prefers *pickup*.

Gates after the follow-up: `typecheck` ✓ · `lint` ✓ (3/3) · vitest **1978/1978** ·
`return-dialog-drive` **105/105** · `document-actions-drive` **46/46**.
