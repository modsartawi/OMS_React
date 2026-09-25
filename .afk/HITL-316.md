# HITL-316 — decisions taken AFK

Contract read: BackOffice 1993 (`status: done`, `## Web contract` present). Cross-checked against committed source on
`C:\Work\DMSCO\BackOffice` main: `AcrInquiryOptions` gains `AcrNumber` (`int?`) + `BusinessDateFrom/To` +
`CollectionDateFrom/To`; `DepositInquiryOptions` gains `DepositNumber` (`int?`) + the four dates;
`CollectionAttemptInquiryOptions` gains the four dates + `ServedByKind`/`ServedById`; `AcrInquiryModel` gains
`FirstCollectedAt`/`LastCollectedAt` (`DateTime?`); `DepositInquiryLineModel` gains `AcrDate` (`DateTime`).
**The contract and the code agree on everything this ticket reads.** No field beyond those three was added to the web.

## Q: What does each screen land on, now that it has two ranges?
**Decision taken:** Each screen keeps the window it always landed on, under its new name. ACRs land on
`BusinessDateFrom/To` = today (the ACR date was always its window). Deposits land on `CollectionDateFrom/To` = today
(deposited-at). Attempts land on `CollectionDateFrom/To` = today (attempt time). The other range is open.
**Why:** The contract maps each legacy `FromDate/ToDate` onto exactly one of the named pairs ("intersects with the
named pair that reads the same column"), so this keeps every landing query answering the same rows as before.
**Revisit if:** finance wants all four screens to land on the same range (e.g. all by collection date, as Collections
does). That would change what the ACRs screen opens on.

## Q: Keep sending the legacy `FromDate`/`ToDate`?
**Decision taken:** No, on all three screens. Each end of each range is sent when filled and dropped when empty (315's
ruling), none is `required`, and there is no client check on From > To.
**Why:** The contract says "The web should send the named pairs and stop sending FromDate/ToDate", and each end is
optional.
**Revisit if:** a server that predates 1993 is served. It would ignore the new names, and the landing query would be
unbounded (the 2,000 cap and its banner still bound it).

## Q: Does Attempts land "default-to-mine" now that it has the Served-by picker?
**Decision taken:** No. Attempts lands on Everyone, as it did before it had the control. The picker still offers
"My branches" as a pick. There is no roster wait before mounting, unlike Collections/ACRs/Deposits.
**Why:** The ticket and contract give Attempts the picker, not a landing scope, and opening narrower than before would
be an unasked behaviour change.
**Revisit if:** finance wants every assignment-reading screen to open on the caller's own branches (BackOffice 1165's
posture). Then add `defaultSelection('attempts', options)` to the landing and a Scope wrapper like `AcrsScope`.

## Q: Which ServedByScreen row does Attempts get?
**Decision taken:** `attempts: { reading: 'assignment', accountants: true, freeText: false }`, identical to
`collections`, and pinned in `served-by.test.ts`. The Collector box (`CollectorStaffId`) stays as a separate free-text
filter and ANDs with Served by.
**Why:** The contract says "the accountant responsible = the store's current assignment (the assignment reading,
exactly as on Collections)", with ACCOUNTANT/COLLECTOR/SUPERVISOR/MINE/UNASSIGNED all accepted, and it keeps
`CollectorStaffId` as "this screen's collector filter".
**Revisit if:** the server starts refusing a Kind on Attempts that it accepts on Collections.

## Q: How is the multi-valued date drawn, and where does its raw data go?
**Decision taken:** ACRs: *Collection Date* is a DERIVED default column (`colId: collectionDate`, no wire field),
placed right after *Business Date*. It shows the span of days `first – last`, one date when both fall on the same day,
and blank when null. The raw `firstCollectedAt` / `lastCollectedAt` join the More-columns tail as *First Collected* /
*Last Collected* (to the minute), and the CSV writes both as raw ISO under those headers. (A first cut drew the span on
the `firstCollectedAt` field itself. The review found the CSV then labelled only the first instant "Collection Date",
so the span was split out.)
Deposits: *Business Date* is a DERIVED column (`colId: businessDate`, no wire field) showing the span of the lines'
`acrDate`, just before *Collection Date* (`depositedAt`). The CSV leaves it out, for the reason it already leaves `lines`
out (the file is the flat row). The separator is an en key, `grid.daySpan` = `{{from}} – {{to}}`.
**Why:** The contract specifies "min … max, or one date when they fall on the same day; blank when null". Keeping the
raw ends in the tail and the CSV follows the rule that nothing on the row is dropped, only folded.
**Revisit if:** finance wants the deposit's business days in the export. The /standards-review spec axis flagged
this: story 81 pulls a deposits file "to find the deposit for a month's days", and that file has no business date.
The contract says nothing about the CSV, so this is an owner call. The cheapest fix is two derived day columns (first
and last line `acrDate`).

## Q: Rename column headers to the contract's labels?
**Decision taken:** Yes, and the filter labels match them. The contract's two default columns are now:
- ACRs: *ACR Date* → **Business Date**, and a new **Collection Date** column.
- Deposits: *Deposited* → **Collection Date**, and a new **Business Date** column.
- Attempts: *Attempt Time* → **Collection Date**. *Business Date* moves from the tail to the default grid, first.
  The split changes from 5/4 to 6/3.
All three toolbars have the same four labelled inputs as Collections: "Business date from/to" and "Collection date
from/to". The old `*.search.from`/`to` keys are removed. Each empty-state hint now says "Widen the business or
collection dates…".
**Why:** The contract labels the columns *Business date* and *Collection date* on every screen. The column then reads
the same as the filter that narrows it, which is 315's precedent.
**Revisit if:** users find "Collection Date" odd on Attempts (nothing was collected) or on Deposits. Each is one en key.
The CSV header follows the grid label, so the export header changes too.

## Q: A non-digit ACR No# / Deposit No#
**Decision taken:** The number box has `pattern="\s*[0-9]+\s*"` plus a `title` hint, so native form validation stops
Search on a non-digit box and no request is sent. The criteria module still sends whatever it is given, trimmed.
**Why:** The server binds an `int`, so non-digits are a 400 before the handler. Silently dropping them would widen the
query instead.
**Revisit if:** a number bigger than Int32 is typed. It passes the pattern and gets the server's 400, which the error
banner shows as "rejected by the server".

## Observed, not changed: the ACR row's money fields drifted before this ticket
The committed `AcrInquiryModel` and 1993's sample row carry `cashSalesTotal` / `settlementTotal` / `bankedTotal`. The
web's `AcrInquiryRow` and ACR grid still read `netCollectedTotal`, which the server **no longer sends** (BackOffice spec
1173 / ticket 1183 renamed it to `BankedTotal`: "byte-identical to the shipped NetCollectedTotal it REPLACES"). Against
a live door, the ACR grid's *Net Collected* column would render blank.
**Why not fixed here:** The field is not one of this ticket's. Renaming a money column belongs to the wave that owns
1183's web half, and the contract says "Do not add fields the contract does not name".
**A human must decide:** which web ticket adopts `bankedTotal` (and whether to show `cashSalesTotal`/`settlementTotal`).
