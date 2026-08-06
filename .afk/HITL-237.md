# HITL log — ticket 237 (a sale line reads like the receipt, in its own currency)

Unattended run, 2026-08-06. Decisions a human would normally weigh in on, taken
conservatively against spec 231 / decision 226 and the repo's conventions.

## Q: Does the currency-aware formatter group thousands, and in whose locale?

**Decision taken:** Grouped (`1,234.50`), with the locale **pinned to `en-US`** inside
`money.ts` rather than left as `undefined`.
**Why:** The feature's existing `formatPoints` already groups, so an ungrouped Amount
column beside a grouped Points column would be the inconsistency; pinning the locale
keeps two agents on two machines reading the same separator, and the app is en-only.
**Revisit if:** the RTL/Arabic retrofit lands — a pinned `en-US` is then a decision to
re-argue, not a default to inherit.

## Q: Does a row with an empty `Currency` count as a distinct currency?

**Decision taken:** No. `salesCurrencies` counts only non-empty, trimmed, upper-cased
codes, so `[SAR, null]` is one currency and grows no Currency column.
**Why:** 226 §4 makes the column conditional to spare the overwhelming SAR-only member
the width of a constant. The column is nullable in source ("old rows can be empty"), so
treating an absence as a second currency would grow the column on exactly the member the
condition exists to protect. An absence is unknown, not another currency.
**Revisit if:** a real window turns out to mix a populated BHD row with null-currency rows
that are in fact BHD — then the absence is hiding a currency and the rule should widen.

## Q: Is Qty formatted currency-aware, like the money columns?

**Decision taken:** No — `formatQty` is a fixed 2 decimals for every row.
**Why:** A quantity is not money; a BHD line's *quantity* has no third decimal to state.
The ticket's own worked example (`-1.00 · 12.00 · -12.00`) shows qty at two decimals.
**Revisit if:** a UOM-fractional line (grams, ml) turns up needing three.

## Q: The column header — "Store" (226's table) or "Store code" (spec §6's labelling rule)?

**Decision taken:** **"Store code"**, and "Item no." as 226 wrote it.
**Why:** Spec 231 §6 is explicit that labels say "code" where the value is one, naming
"Store code" among its examples, and the header already reads `City code` / `Nationality
code` in the member disclosure. 226's table is a column *list*, not a copy deck.
**Revisit if:** the door ever joins a store name onto the report — then the label is
"Store" because the value is one.

## Q: Sales was the last unbuilt panel bar Actions — did the strip's `notYet` copy change?

**Decision taken:** Kept `tabs.notYet` verbatim, now shown only for Actions.
**Why:** 238 removes the last consumer; rewording a string one ticket before it is deleted
is churn. The comment above it was corrected from "two unbuilt panels" to "one".
**Revisit if:** 238 slips and Actions stays unbuilt for longer than this wave.
