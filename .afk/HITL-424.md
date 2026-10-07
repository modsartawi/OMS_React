# HITL — ticket 424 (Waiting for collection opens blank, filters, Saud's mapping)

## Q: Which open-blank seam, empty state and Reset behaviour does Ready use?
**Decision taken:** 423's, copied (not extracted). The Page's applied criteria are `ReadyCriteria | null`, `null` until the first Search. `readyParamsFor(null)` answers `null` (vitest: `ready landing issues no request and keeps servedBy`), and `useQuery` is `enabled: appliedParams !== null`. The empty grid says "Press Search to see what is waiting" (`ready.landing.*`), and this state is tested before `isPending`. Reset returns to the un-searched landing: the empty draft with the default Served-by scope, applied `null`, no request. The Filtered chip stays dark before the first Search and on an empty-box Search. A Search on an unchanged draft re-asks the door (`sameQuery` + `refetch`). `sameQuery` is copied into `ready-criteria.ts`.
**Why:** The runner says 424 must copy 423's choice.
**Revisit if:** the owner rules differently on 423.

## Q: "Store Code" in the mapping: the raw `storeId`, or the composed `storeText`? The ticket also says "Store id … stay under More columns"
**Decision taken:** Store Code = **`storeId`**, whose en label is already "Store Code". Profit Center = raw **`profitCenter`**. The composed **`storeText`** ("Profit Center (Store)", `PH-019 (P019)`) moves into the More-columns tail, together with shift id and settlement document id. This is exactly what 423 did on Cash Collections.
**Why:** The mapping cannot both show Store Code at position 2 and keep store id in the tail. Mapping by label matches Cash Collections. Putting `storeText` at position 2 would show "PH-019 (P019)" under "Store Code", right next to a Profit Center column showing "PH-019". I read the tail sentence (in the ticket, and spec 2423's "remaining tail fields (store id, …)") as meaning the composed store text.
**Revisit if:** the owner meant the composed `storeText` as "Store Code". In that case swap `storeId` and `storeText` in `ready-columns.ts`. Suggested spec amendment: "(composed store text, shift id, settlement document id)".

## Q: Which column labels were renamed to the mapping's names?
**Decision taken:** **None.** Column 1 "Entry No" still reads "Shortage Entry", column 6 "Type (kind)" still reads "Waiting", and column 14 "Card slips" still reads "Slips" (the shared `slips.column`). Only the order changed. The new toolbar filter is named "Type", with Day / Settlement receipt, as the ticket says.
**Why:** The ticket's mapping paraphrases fields ("Cash to hand over", "Business Day", "Z No", "Ready since"), so it does not quote headers verbatim the way Saud's 31 were. Renaming is a copy change nobody ordered. "Slips" is a key shared with Cash Collections.
**Revisit if:** the owner wants the two screens to read alike word for word. That would mean `ready.columns.kind` → "Type" and `ready.columns.entryNumber` → "Entry No", both one-line locale edits.

## Q: The mixed-currency "promote Currency" rule
**Decision taken:** Removed. The mapping puts Currency at position 10 on the landing grid, so it is always shown and there is nothing left to promote. Money headers still carry the currency when the result has a single one.
**Why:** This follows from the mapping.
**Revisit if:** —

## Q: Type / Amount controls
**Decision taken:** Two native checkboxes ("Day", "Settlement receipt") in a "Type" fieldset. They are sent as a repeated `Kinds` key in the toolbar's order, and nothing is sent when nothing is ticked. Amount from/to are TEXT boxes (`inputMode="decimal"`, `dir="ltr"`), sent trimmed as typed. From > To or a malformed amount goes to the server, and its refusal shows in the error banner. Profit center is a text box. All of this mirrors 423.
**Why:** It is consistent with 423 and needs no dependency.
**Revisit if:** —

## Copy changes
- `ready.capReached` and `ready.empty.hint` now name the new filters. `ready.search.clearFilter` → "Clear the filters and start over", which is 423's wording and avoids "Search" in an aria-label.
- `ready.landing.hint` says that an untouched Search is limited to the branches "Served by" names. A /code-review finding showed that "every box empty → see everything" would be false for a roster user. ⚠ **423's `collections.landing.hint` makes the same false claim** ("press Search with every box empty to see them all") while Served by defaults to mine. That copy belongs to 423, so I left it alone; the owner should reword it.

## Note: wire contract vs the committed server
BackOffice 2425 (86235032b on `afk/spec2423`) binds `Kinds` (string[], DAY/SETTLEMENT), `AmountFrom`/`AmountTo` (decimal?) and `ProfitCenter`. This agrees with the oms ticket's contract, so there is no disagreement.

## Note: pre-existing drive failures (not caused by 424)
- `ready-drive` 2 checks: "menu — the Ready grant alone lights the one leaf" and "a collector supervisor sees the five read screens". Both count `getByRole('link')` on the page, but since spec 380 the menu lives in the collapsed rail, so 0 links are found. `src/layout` and `src/app` are unchanged since base 02ad20d.
- `foundation-drive` 8 checks: the topbar's control list (it now holds the Ctrl K search) and the bell's isolated time count, ×4 themes/directions. Nothing in them concerns this slice.

## Note for the owner (not a decision): cap number
As on 423: the spec says "the newest 500", and the screen's cap is still `GRID_LIMIT` = 2,000.
