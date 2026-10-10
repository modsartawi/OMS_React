# HITL log — ticket 446 (sync console Store page)

## Q: Contract drift — the envelope's error entries
**Decision taken:** Same as HITL-445: the drive stubs the REAL SIS.Api envelope `errors: [{ errorCode, errorMessage, internalErrorCode }]`, not the contract's abbreviated `{ code, message }`; `NO_STORE` is read only through `apiErrorCode`.
**Why:** `src/core/api.ts` is the one reader of the envelope.
**Revisit if:** BackOffice 2539 really ships `{ code, message }`.

## Contract gap: is the Passes 30-day bound inclusive, and by date or by time?
**Decision taken:** The picker's `min` is today − 30 calendar days (LOCAL date), inclusive, and `from` is sent as a bare date. The bound is re-read on every render/edit so a tab left open past midnight moves with the calendar.
**Why:** The contract says only "may not be older than 30 days (retention); an older date is a 400 BAD_DATE".
**Revisit if:** The door compares against `Now.AddDays(-30)` with a time of day — then today − 30 at 00:00 is refused, and `min` must be today − 29.

## Q: Does a WPF store show the 24 h strip?
**Decision taken:** No. A WPF store shows its header, a note that WPF still syncs it, and only the Counters and Passes tabs — no health summary and no strip (its hours would all be "no data", and the strip is worker-written).
**Why:** The contract: "the console shows only its counters and passes".
**Revisit if:** The owner wants the (empty) strip shown for WPF stores too.

## Q: Does the store page refresh itself?
**Decision taken:** The header and the strip ride the Fleet page's 30 s refresh; the tabs read once when opened. A failed header refresh hides the stale health (as the Fleet page does); a failed strip refresh keeps the last good strip under its error. A `NO_STORE` stops the polling.
**Why:** A store being watched must not go stale on screen; the spec names 30 s polling only for the fleet page, so the same cadence is reused rather than invented.
**Revisit if:** The owner wants the store page static (refresh on demand only).

## Q: The open tab
**Decision taken:** Kept in the URL as `?tab=` (the Loy member tab-shell precedent), replacing the history entry; a withheld or unknown tab falls back to Counters.
**Why:** A link to "this store's passes" survives a reload; it is the repo's existing tab idiom.
**Revisit if:** The owner prefers in-memory tab state.

## Q: The hour-cell colours
**Decision taken:** work → `bg-success`, idle → `bg-success/35`, passErrors → `bg-attention`, connectFailOnly → `bg-danger`, noData → `bg-muted`. An unknown cell is drawn as noData.
**Why:** The prototype's five colours mapped onto app tokens (the palette gate refuses literals).
**Revisit if:** The owner eye on the page against the prototype reads them differently.

## Q: A script's state word
**Decision taken:** `isExecuted` → "Executed"; not executed with an `errorMessage` → "Failed"; else "Not run yet". No retry promise is stated (the contract states none).
**Why:** Reads only the door's two fields; claims nothing the contract does not.
**Revisit if:** BackOffice documents the retry cadence and the owner wants it on the page.

## Q: Extra facts in the health summary
**Decision taken:** Each loop's block shows its last pass time and outcome beside its last error; the "as of" stamp reads `healthUpdatedAt`.
**Why:** They are fields of the same `LoopHealth` the ticket's "last error per loop" reads, and they tell a stale error from a current one.
**Revisit if:** The owner wants the summary trimmed to the ticket's list.
