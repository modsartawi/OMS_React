# HITL-317 — decisions taken AFK

Contracts read: BackOffice 1994 and 1995. Both are `status: done` and both have a `## Web contract` section. I
cross-checked them against the committed code on `C:\Work\DMSCO\BackOffice` main:
- `CollectionReadyRowModel` / `CollectionReadyOptions`: `StoreText` is a computed get-only property. It is serialized
  like the rest.
- `CollectionWebEndpoints`: `MapGet($"{Tag}/Ready")` sits behind `ReadyGrantEndpointFilter`, and the probe sends
  `canOpenReady`.

**The contract and the code agree field for field.** No field the contract does not name was added to the web.
1995 adds no field and no route, so the web keys nothing off a role name.

## Q: What does the screen land on?
**Decision taken:** No business date. The Collector box is empty. Served by uses **default-to-mine**
(`defaultSelection('ready', options)`), as on Cash Collections, and the body waits for the roster before it mounts.
A session with no roster row (e.g. a collector supervisor) lands on the estate.
**Why:** 1994's Done-when says "sees every closed, uncollected day and prepared receipt **of their stores**". Any
business-date bound would hide every prepared receipt, and pre-September pending days belong on the list too.
**Revisit if:** finance wants Ready to open on the whole estate for accountants too (as Attempts does). The fix is one
line in `landingCriteria`.

## Q: Collector filter: a free-text box or a roster picker?
**Decision taken:** A free-text "Collector" box (staff id) sending `CollectorId`, copied from the Attempts screen's
Collector box. It ANDs with Served by.
**Why:** The contract names `CollectorId` as its own parameter, and the sibling screens use a free-text box for their
collector filter. The Served-by picker already offers roster collectors (`COLLECTOR` Kind) for anyone who wants to pick.
**Revisit if:** users expect a dropdown of the roster's collectors here.

## Q: How are the store and the profit center shown?
**Decision taken:** The landing column is labelled **"Profit Center (Store)"** and renders `storeText` exactly as sent
(`PH-019 (P019)`, or the code alone). The raw `profitCenter` and `storeId` sit in the More-columns tail. Nothing is
formatted client-side.
**Why:** The contract says `storeText` is "the store as every paper and grid prints it … render this in the store /
profit-center column". The wave's 314 ruling is that the formatter is server-side.
**Revisit if:** 314 settles a different header label for the same column on the other grids. It is one en key
(`ready.columns.storeText`).

## Q: Columns the ticket's list does not name
**Decision taken:** Two columns were added to the landing grid:
- **Waiting** (`kind`: "Closed day" / "Prepared receipt").
- **Shortage Entry** (`entryNumber`).

`shiftId`, `settlementDocumentId` and `currencyKey` go to the tail. When the result mixes currencies, Currency is
promoted into the default set (Cash Collections' rule). Every null draws `—`, and so does an `entryNumber` of 0.
**Why:** The ticket lists "store, profit center, business day, Z number, cash to hand over, surplus deducted, days
waiting". Without the kind and the entry number, a receipt row would carry no identity but its store. Both are contract
fields; no field was invented. "A null is an absence, never a zero".
**Revisit if:** finance wants a leaner landing grid.

## Q: CSV export?
**Decision taken:** Not built. There is no Export button on Ready.
**Why:** Neither the ticket nor the contract asks for one, and the four siblings' export (258) was its own ticket.
**Revisit if:** finance wants a file of what waits. `useCsvExport` + a `READY_CSV_COLUMNS` entry would add it.

## Q: `Limit`
**Decision taken:** The screen sends `Limit=2000` (`GRID_LIMIT`, the siblings' cap) with the siblings' cap banner.
**Why:** The contract's default is 500 and its ceiling is 20000. One cap across the area keeps the banner honest.
**Revisit if:** the estate's waiting list ever approaches 2000 rows.

## Q: A bare 403 from the door (probe said yes)
**Decision taken:** The screen shows its own sentence ("Your account is not allowed to read the ready-for-collection
list…") instead of "Unexpected API error (HTTP 403)". The Served-by resolver's 400 envelope shows the server's message.
The binding 400 shows the shared "rejected" sentence.
**Why:** The contract's refusal list gives the 403 no body, so there is no server message to show.
**Revisit if:** SIS.Api starts sending an envelope on that 403.

## Q: Tell the reader that a business date hides receipts?
**Decision taken:** Yes. When the ISSUED query carries either business bound, a muted line under the toolbar says
"Prepared receipts have no business date, so they are not listed while a business date is set."
**Why:** The contract says "any business-date bound excludes receipts". Without the line, a missing receipt looks like
a collected one.
**Revisit if:** the server starts matching receipts on a business range.

## Not done here (owner / live)
- Nothing was driven against a live SIS.Api with 1994. Every drive envelope is stubbed.
- The grant seed must be re-run on OMS-HQ before SIS.Api ships (BackOffice 1997 runbook).
- Binding `COLLECTOR_SUPERVISOR` to people is Authz Admin work.

## Review round
- **/code-review:** no findings. One edge-case note was taken: `readyRowId` now falls back to whichever key the row
  carries for a kind the client does not know.
- **/standards-review, standards axis:** no hard violations. Fixed:
  - a stale comment in `menu-collection.test.ts`;
  - a rewrap in `served-by.ts`;
  - "queue" → "list" (the glossary avoids "queue");
  - `readyKindKey` now reads `READY_KINDS`, one source for the kinds;
  - the ambiguous "Receipt Id" → "Settlement Document Id";
  - "Prepared receipt" → "Prepared settlement receipt" ("receipt" alone is the سند قبض);
  - two `CONTEXT.md` entries: *Ready for collection* and *Collector supervisor*.
- **Declined, standards axis:**
  - `kind: CollectionReadyKind | string` is kept on purpose, so an unknown kind still renders.
  - The `Ready*` / `ready-*` names mirror the screen's nav label and route (`/collection/ready`).
  - The empty `NON_COLUMN_FIELDS` keeps the siblings' completeness proof shape.
- **/standards-review, spec axis:** clean. It noted two things:
  - an `entryNumber` of 0 draws a dash, a client-side reading of "0 on a day / if the entry is gone";
  - `Limit` 2000 vs the contract's default of 500 (logged above).
