# HITL: ticket 338 (the assignment upload carries the profit center)

Built against the `## Web contract` committed in BackOffice 2157 (`e44716bc5`, worktree `BackOffice-2149`). Nothing in the BackOffice repo was touched.

## Q: Template column order: the ticket's `StoreCode, ProfitCenter, AccountantId, CollectorId`, or the contract's `StoreCode | AccountantId | CollectorId | ProfitCenter`?
**Decision taken:** The ticket's order. The branch's own two cells come first, then its two people.
**Why:** The door reads columns by name, in any order, so the contract's order is a description, not a constraint. The web owns the template it hands out, and the ticket names this order outright. The spec reviewer flagged that the two disagree, and that the template file used to say it "picks the contract's".
**Revisit if:** the owner wants the template to match 2157's listing. That is one array in `assignment-template.ts` and its test.

## Q: Do the four `PROFIT_CENTER_*` refusal codes get their own words on screen?
**Decision taken:** No. They show the server's English line, like any code this screen has no key for. Each one is hung on its row, or on the file for `PROFIT_CENTER_UNAVAILABLE` (row 0).
**Why:** The over-long sentence names the value, its length and the limit, and the server reads that limit off the live column. A key would have to hard-code "20" and would be wrong the day the column widens. This is the same ruling as `AssignmentUploadFileUnreadable`.
**Revisit if:** finance finds the server's wording unclear. Add the code to `UPLOAD_ISSUE_CODES` and give it a key.

## Q: The done line said "N branches assigned from the file". A profit-center-only branch is in `appliedStoreCodes`.
**Decision taken:** It now reads "N branches changed from the file", matching the page notice. The i18n key stays `done.applied`.
**Why:** A branch whose only change is its profit center was not assigned anything.
**Revisit if:** the owner prefers "assigned".

## Q: `STORE_REQUIRED` said "This row names a person but no branch". 2157 also raises it for a row that names only a profit center.
**Decision taken:** It now reads "This row names a person or a profit center but no branch."
**Why:** Without the fix, the sentence would be false for a profit-centers-only sheet, which 2157 accepts.

## Q: "After commit, on the collection screens": does the web need to invalidate their queries?
**Decision taken:** No explicit invalidation. Cash Collections, Ready and Attempts are other routes, and their list queries carry no `staleTime`, so they refetch on mount.
**Why:** None of them is mounted while the assignment dialog is open. Invalidating them would only mark entries stale that are already stale.
**Revisit if:** a collection grid ever gains a `staleTime`, or comes to share a page with the upload.
**Owed:** a live smoke on dev SIS.Api once migration 092 is on POS_Server. Upload `PH-019` against a branch and see "PH-019 (P019)" on Cash Collections. Every drive in this ticket is stubbed.

## Q: Against a door older than 2157 (no profit-center fields), what does the column show?
**Decision taken:** "None recorded", unchanged, for every row. The three fields are typed optional and read through `profitCenterChange`.
**Why:** It never shows a change the server did not report. One side effect: if the file carried values that an old door ignored, the column still says "None recorded". That is true of what the old door will write.
**Revisit if:** the web ever ships ahead of BackOffice 2157 and finance relies on the column during that gap.
