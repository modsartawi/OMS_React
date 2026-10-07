# HITL — ticket 423 (Cash Collections opens blank, filters, Saud's order)

## Q: What exact seam proves "no request on landing", and what does Reset do?
**Decision taken:** The Page's applied criteria are `CollectionsCriteria | null`, `null` until the first Search. `collectionsParamsFor(acrId, applied)` (acr-scope.ts) answers `null` for an unscoped screen with nothing applied, and the Page's `useQuery` is `enabled: queryParams !== null`. The vitest proof asserts `collectionsParamsFor('', null) === null`. The empty grid shows "Press Search to see collections" (`collections.landing.*`), tested BEFORE `isPending` (a disabled query is still pending). **Reset returns to the un-searched landing**: the empty draft with the default Served-by scope, applied = `null`, no request. The Filtered chip is dark before the first Search and on an empty-box Search. The `?acr=` drill-down still loads at once (following an ACR's link is the search); clearing its chip is Reset, so it returns to the un-searched landing.
**Why:** It is the retail-invoice screen's shipped pattern (`appliedParams === null`), it needs no RTL, and "back to where it opened" is the conservative reading of Reset.
**Revisit if:** the owner wants Reset to re-issue the empty Search, or wants the ACR chip's ✕ to keep the user's last search instead of dropping it. 424 and 425 must copy this choice.

## Q: Saud's "Card Slips" (header 24): is it the slip-probe count (`slipCount`) or `cardTransactionCount`?
**Decision taken:** **`cardTransactionCount`.** Every one of Saud's 31 headers is, verbatim, an existing `collections.columns.*` en label, and "Card Slips" is the label of `cardTransactionCount` (the till's count of card slips). The sheet is clearly an export of the grid's 31 columns without the slip-probe column. So Card Slips = `cardTransactionCount` at position 24 (between Counted (Net) and Reason Detail), always under More columns as before. The slip-probe count (`slipCount`, header "Slips") stays gated on the probe and is now placed **right after Card Slips** (`withSlipColumn` gained an optional anchor; Collections passes `cardTransactionCount`, Ready keeps the default `cardTotal`). Hidden, it shifts none of the 31.
**Why:** The ticket and runner both say "Card Slips is the slip-count column", but taking that literally drops `cardTransactionCount` from the grid. That breaks "no field is added / nothing is dropped" and the completeness proof's spirit, and it relabels a column away from the header Saud actually wrote.
**Revisit if:** Saud or the owner meant the attached-slip count. In that case `cardTransactionCount` needs a ruling (non-column or renamed), and the slip column moves to 24.

## Q: Which en labels were renamed to match Saud's headers?
**Decision taken:** **None.** All 31 headers already equal their existing en labels. Only the ORDER and the visible split changed: Receipt No#, Sales Date and Collector Name are now default, and Card Total / Variance / Store Name moved into the tail.
**Why:** The headers are verbatim, and they match already.
**Revisit if:** —

## Q: How does an array param (CollectionTypes) reach the wire?
**Decision taken:** `core/api.ts` `buildQuery` now repeats the key for each array element (`qs.append`) and drops empty elements, so an empty array sends nothing. Before this change, an array would have been `String(arr)` = `"A,B"`, one value. No existing caller passes an array (checked), so no shipped query changes. The test is in `src/core/api.test.ts`. 424 (`Kinds`) can rely on it.
**Why:** ASP.NET binds `string[] CollectionTypes` (BackOffice 81db48517, as committed) from repeated keys. A core change is the only place this can live under the api-envelope rule.
**Revisit if:** a server door ever wants a comma-joined list. That caller should join it itself.

## Q: Copy changes caused by the blank landing
**Decision taken:** These strings said "today", which is no longer true, so I reworded them:
- `collections.loading` → "Loading collections…"
- `errors.loadFailed` → "Collections could not be loaded."
- `search.clearFilter` → "Clear the filters and start over"
- `acrScope.clear` → "Clear the ACR and start over"
- `empty.scopedHint` → "…Clear the ACR to start a search of your own."
- `empty.title` → "No collections match this search"
- `empty.hint` and `capReached` now name the new filters.

"start over" deliberately avoids the word "Search": an aria-label containing it collides with the Search button's accessible name.
**Why:** Leaving "today" would make the screen say something false.
**Revisit if:** the owner wants different wording.

## Q: Type control shape
**Decision taken:** Five native checkboxes in one fieldset, "Type": Regular, Short, Outside system | has Surplus, has Stolen. The base types travel in the toolbar's order whatever order they were ticked in. A tick is sent only when ticked (`HasSurplus=true`), never `=false`. Amount boxes are TEXT inputs (`inputMode="decimal"`, `dir="ltr"`), sent as typed and trimmed. (A first cut used `type="number"`; /code-review showed it hands back `''` for an unparseable `12,5`, silently dropping the filter while the box still shows it.) A malformed amount therefore reaches the door, and its binding 400 shows in the error banner as "rejected by the server", not as the criterion refusal. From > To is sent too, and the server's criterion refusal is shown through `apiErrorMessage`.
**Why:** Adds no dependency, matches the ticket's "multi-select plus ticks" wording, and leaves the From/To rule to the server.
**Revisit if:** the owner prefers a dropdown multi-select, or wants client-side decimal validation with its own sentence instead of the door's binding refusal.

## Note for the owner (not a decision): cap number
The spec says "the newest 500". The screen's shipped cap is `GRID_LIMIT` = 2,000, and the cap notice measures that. I left it unchanged; the empty-box Search returns the newest rows under the existing cap and its existing notice.

## Note: pre-existing drive failures (identical at base 02ad20d, not caused by 423)
- `collection-drive`: two ACR (255) assertions expect `BusinessDateFrom` on the ACR landing. 425 owns that landing.
- `collection-print-drive`: two Hijri/ACR print assertions fail.
- `profit-center-drive`: crashes in its CSV-export reader, because exports have been xlsx since ticket 336.
