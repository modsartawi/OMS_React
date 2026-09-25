# HITL-315 — decisions taken AFK

Contract read: BackOffice 1992 (`status: done`, `## Web contract` present). Cross-checked against committed source on
`C:\Work\DMSCO\BackOffice` main: `CollectionInquiryOptions` carries `BusinessDateFrom/To` + `CollectionDateFrom/To`
(`DateTime?`, bound by `[AsParameters]`, PascalCase), and `CollectionInquiryModel.BusinessDay` is `DateTime?`.
**The contract and the code agree.** No new field beyond `businessDay` was added to the web row.

## Q: Keep "the dates travel as a PAIR or not at all", or send each end alone?
**Decision taken:** Each of the four ends is sent when filled and dropped when empty. The collection date inputs lose
`required`, and the old pair guard is gone.
**Why:** The contract says "Either end may be sent alone (an open-ended range)" and "both ranges optional". Asking
about sales days alone (story 77) means leaving the collection range empty, which `required` would forbid.
**Revisit if:** finance wants a collection range to be mandatory. An empty collection range with no business range
asks for the whole history, which the 2,000 cap and its banner bound but do not prevent.

## Q: Keep sending the legacy `FromDate`/`ToDate`?
**Decision taken:** No. The collected-at period now goes only as `CollectionDateFrom`/`CollectionDateTo`. The landing
state is still today..today by collection date.
**Why:** The contract says "The web should switch to CollectionDateFrom/CollectionDateTo and stop sending these".
**Revisit if:** a server that predates 1992 is served. It would ignore the new names, and the landing query would
then be unbounded.

## Q: Rename the existing "Collected" column header?
**Decision taken:** Yes, to "Collection Date". The new column is "Business Date". Both are default columns, side by
side, the sales day first (`collectorName`, `businessDay`, `collectedAt`, …). `salesDate` stays in the tail.
**Why:** The contract labels the two default columns *Business date* and *Collection date*. The column then reads the
same as the filter that narrows it. The contract rules `salesDate` out as the business column.
**Revisit if:** users know the column as "Collected". It is one en key (`collections.columns.collectedAt`). The CSV
header follows the grid label, so the export's header changes too.

## Q: Toolbar labels and layout
**Decision taken:** Four labelled native date inputs, in this order: "Business date from", "Business date to",
"Collection date from", "Collection date to". Then Store, Collected by and Served by, as before. The old
`collections.search.from`/`to` keys are removed. The empty hint now says "Widen the business or collection dates".
**Why:** This is the smallest change that names each range by its meaning. 316 copies it.
**Revisit if:** a designer wants each range grouped under one heading, with a From/To pair.

## Q: A From later than its To
**Decision taken:** The web sends it as typed, with no client check. The server matches nothing, and the screen shows
the ordinary empty state.
**Why:** The contract: "A From later than its To is not refused — it simply matches nothing." A client refusal
would be a rule the server does not have.
**Revisit if:** users read the empty grid as "no collections" rather than as a mistyped range.
