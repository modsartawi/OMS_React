# HITL-313 — decisions taken AFK

Contract read: BackOffice 1987 (`status: done`, `## Web contract` present). Cross-checked against committed source on
`C:\Work\DMSCO\BackOffice` main: `AcrInquiryModel.ClosedBy` + `ClosedByName` (strings, `AcrModel.cs:124-125`), the
`CASE … END AS ClosedByName` in both `AcrInquiryService` SELECTs (SYSTEM verbatim, else Staff name, else the id), and
`AcrFormBuilder.ClosedByText` feeding `AcrFormDocument`. **The contract and the code agree on the three fields.**

## Q: The ticket says SYSTEM reads "Closed automatically at end of day"; the contract says `closedByName` is "SYSTEM" verbatim. Which does the grid show?
**Decision taken:** The grid's Closed By cell shows the en key `acrs.closedBy.system` ("Closed automatically at end of
day") when the RAW `closedBy === 'SYSTEM'`. Otherwise it shows `closedByName` verbatim, and `''` stays blank.
**Why:** The ticket asks for the sentence. The contract says what the server sends, not what the web must print. The
match is on `closedBy` because that is the column the contract defines the literal on.
**Revisit if:** finance wants the bare `SYSTEM` on screen. Drop the one branch in `closedByText` (`acr-columns.ts`).

## Q: Where does the Arabic ("EN+AR") half of the ticket go?
**Decision taken:** Nowhere on the web. The screen is en-only (no Arabic bundle). The Arabic reaches the user only
through the server's form string `closedByText` (`النظام (SYSTEM)`), printed as given on the ACR form.
**Why:** The wave rule is English-only, zero-literal. The form is the documented Arabic facsimile exception, and the
contract says to render `closedByText` as given.
**Revisit if:** an Arabic bundle is ever added. The key `acrs.closedBy.system` is then translated as data.

## Q: Default column or tail? And what happens to the raw `closedBy`?
**Decision taken:** `closedByName` ("Closed By") is a DEFAULT column, beside Status. `closedBy` ("Closed By Id") folds
into the More-columns tail, beside Closed. This is the `collectorName` / `collectorOperatorId` pairing. The default
set goes from 8 to 9 columns, and the grid from 15 to 17.
**Why:** The ticket asks for a closed-by column on the grid. The contract calls SYSTEM the "forgotten ACR" marker finance
scans for, so it cannot hide behind a toggle. The completeness test requires every wire field to be placed somewhere.
**Revisit if:** the default grid is judged too wide. The column would then move to the tail.

## Q: Should sort and filter use the shown sentence or the raw SYSTEM?
**Decision taken:** The Closed By column uses a `valueGetter`, so sort works on what the cell shows. Its
`filterValueGetter` answers to both the sentence and the literal `SYSTEM`, and only on a swept row. So "automatically"
and "SYSTEM" each find the swept ACRs, and the cell never draws `SYSTEM`. The raw value also has its own tail column.
This was added after the spec review: the contract calls `SYSTEM` the marker finance filters on.
**Why:** This repo's grids filter on what is on screen (255's date ruling). The contract's marker has to keep working
in the column finance actually looks at.
**Revisit if:** the hidden token surprises anyone, for example "SYS" matching a row whose cell does not show it.

## Q: What does the CSV export write for a swept ACR?
**Decision taken:** The raw value. `closedByName` is `SYSTEM` (text) and `closedBy` is `="SYSTEM"` (identity, so a staff
id keeps its leading zero). The screen's sentence is not written.
**Why:** The file is the row unpacked (ISO dates, bare money), and `SYSTEM` is the marker a workbook filters on.
**Revisit if:** finance wants the file to read like the screen.

## Q: The form header's two spaces, and a long name
**Decision taken:** أُغلق بواسطة is the fourth cell of the تاريخ التحصيل / الوصف / الحالة row (where the WPF puts it).
Its value is `white-space: pre-wrap`, so `name  (id)` keeps both spaces, and a long name wraps inside its own
quarter of the strip. On screen, `إبراهيم ياسين الشمري  (40219)` wraps to two lines at 176px. `collection-print-drive`
still passes 151/151, including its one-A4 checks on the three-page fixture that carries that name.
**Why:** The contract gives the format and the position. Widening one cell would re-flow the other three.
**Revisit if:** the paper proof (a human eye on A4) dislikes the wrap. A wider flex share for that cell is a CSS change.

## FINDING (not this ticket's, not fixed): the web's `AcrInquiryRow` still reads `netCollectedTotal`
The committed `AcrInquiryModel` (BackOffice 1183) and 1987's own sample carry `cashSalesTotal` / `settlementTotal` /
`bankedTotal`, and **no `netCollectedTotal`**. The server's comment says `BankedTotal` is byte-identical to the
`NetCollectedTotal` it replaced. So against a live SIS.Api, the ACRs grid's **Net Collected column and its CSV column
are blank**. `acr-closed-by-drive.mjs` stubs 1987's sample verbatim and shows exactly that blank.
The model also lacks `firstCollectedAt` / `lastCollectedAt`, but those are 1993's fields and belong to ticket 316.
**Decision taken:** Not fixed here. 313's contract names only `closedBy` / `closedByName` / `closedByText` as its change
("Do not add fields the contract does not name"). The rename would rewrite 255's and 258's money columns and their
proofs, which reaches past a closed-by slice.
**Revisit:** a human should schedule it. It fits ticket 316, which rewrites this row type for 1993 anyway, or a small
ticket of its own. It is a live money-column defect, and it predates this wave.

## Reviews
- `/code-review`: no correctness bug. Acted on: `ACR_SYSTEM_CLOSER` had split `AcrInquiryRow` from its doc comment,
  so the constant moved above it.
- `/standards-review`, Standards axis: no hard violation. Acted on: `pre` renamed to `keepSpaces`, and the `?? ''` in
  `closedByText` now has a comment (a pre-1987 server omits the field). Left: CONTEXT.md does not name the 23:59
  sweep or the closer. BackOffice's CONTEXT.md carries it, and this repo's glossary is `/domain-modeling`'s call.
  The repeated mono id-column shape is area-wide and predates this change.
- `/standards-review`, Spec axis: faithful to the contract. Acted on: item 1 (the SYSTEM filter, above). Left for a
  human: the `netCollectedTotal` / `bankedTotal` drift (the FINDING above).
