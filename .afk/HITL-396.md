# HITL log — ticket 396 (each delivery row shows its derived Status)

## Q: How is pick-in-store recognised on the LIST row, whose `deliveryType` is a description?
**Decision taken:** `timelineInputFromRow` treats a trimmed, case-blind `P` or `PickInStore` as pick-in-store. The header mapper keeps the coded `P` only.
**Why:** The ticket says `deliveryType 'P'`, but the list returns descriptions ("Delivery  ", "PickInStore"): see the `trimmedCol` comment in `columns.ts` and the captures. Accepting only `P` would never fire on the list.
**Revisit if:** SIS.Api's list starts sending the code, or a third spelling appears.

## Q: Which inks do the Status words take (the dots are 368 §3's tokens)?
**Decision taken:** The dots are `--ink-3` (Created, Ready), `--primary` (Out), `--success` (Delivered), `--fam-cancel-request` (Cancellation requested) and `--danger` (Cancelled). The words use `--muted-foreground`, `--primary`, `--success-800`, `--fam-cancel-request` and `--danger-800`. I added one contrast pair, `--fam-cancel-request` on `--card` at BODY, to `check-contrast.mjs`.
**Why:** The approved capture `368-shots/A-open-light.png` tints the word too. The `-800` inks and `--primary` are already measured as text on `--card`, and the indigo was not. The drive measures every word at ≥ 4.5:1 in both themes.
**Revisit if:** The owner wants the words in the bare `--success` / `--danger` tones, as the prototype drew them.

## Q: Does the derivation carry the next step's slot-window expectation now?
**Decision taken:** No. The derivation marks the first unreached step `next`. The surface that draws it (397's inspector, 402's Details) attaches `deliveryWindow()`'s expectation. `deliveryWindow` stays in the document feature until a second feature needs it.
**Why:** 396's D1 list (steps, reached, cancellation, rewind marker, row-field times, due/paid tag) doesn't include the expectation, and nothing in 396 renders a timeline. Moving `deliveryWindow` now would be half of 397.
**Revisit if:** 397 wants the expectation inside the pure output. Then `deliveryWindow` graduates to `@/core` and the input gains a `window`.

## Q: What does the header (Details) mapper carry before S4 feeds it the Log?
**Decision taken:** No times. The rewind KIND comes from `status.lastAction` (`DRBK` returned, `DRSC` rescheduled, `DCHC` courier changed), with `time: null`, so no marker shows on Details until the Log dates it.
**Why:** 369 §4 says a Details step's time is the latest matching Log row's, never a row field. 369 §3 says "the marker also needs the action's time". The ticket says S4 extends the input with the Log.
**Revisit if:** 402/403 want an undated marker.

## Q: Which step carries the rewind marker, and when is it shown?
**Decision taken:** Always Created, and only when the rewind has a real time. A row with `rescheduled` but a blank or `0001` `rescheduledTime` shows no marker.
**Why:** 369 §3 says "the step it fell back to", and the evidence shows every rewind clears or invalidates the ready and delivery statuses (DRSC and DCHC clear them, DRBK writes S/B), so each falls back to Created. This holds even though the row's `rescheduled` flag is sticky after the delivery moves on. The standards-review spec axis flagged the first draft, which put the marker on the current step (the prototypes' placement) and showed undated markers.
**Revisit if:** The owner prefers the prototypes' placement (on the current step), or wants an undated marker.

## Q: How does the due/paid tag treat sub-halala, negative and missing amounts?
**Decision taken:** It is Paid unless `amountDue` rounds to at least 0.01. The tag returns the formatted amount, and the surface supplies the words. No `Due`/`Paid` keys were added, because nothing renders the tag in 396.
**Why:** The rule is "Due while > 0". A "Due 0.00" tag would be noise. Keys are added in the change that uses them (397/402).
**Revisit if:** Finance wants any positive residue shown.

## Q: Where does Status sit for an operator's view saved before this slice?
**Decision taken:** Unchanged code path. `applyColumnState({ applyOrder: true })` places a column the saved state does not name wherever AG Grid puts it.
**Why:** 400 owns the saved-view store and its one-time import. Re-ordering old views here would restructure a surface that slice builds.
**Revisit if:** Operators report Status at the far end on their saved views before 400 lands.

## Q: Extend `grid-theme-drive.mjs` or start a list drive?
**Decision taken:** I started `tools/deliveries-list-drive.mjs` as S3's list drive, for 397–401 to extend. `grid-theme-drive.mjs` was re-run unchanged (125/125).
**Why:** The ticket allows either. S3 needs one list drive, and the grid-theme drive is about tokens across modules.
**Revisit if:** —
