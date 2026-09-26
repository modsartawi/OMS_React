---
type: spec
status: ready
---

# 319 — ECR slips at the day close: the web half (frontend half of BackOffice spec 2030)

The stories, decisions and glossary are BackOffice's: read
`C:\Work\DMSCO\BackOffice\.issues\2030-ecr-slips-at-the-day-close-spec.md` (merged into `pricing2` as
`da71a9621`, 2026-09-26). This file lists only what the web builds.

A store's manager attaches the ECR (card terminal) slips to the day close on the till. Finance, the
collection accountant, checks them from the collection screens. The web half does four things:

1. It shows a slip count per store day on **Ready for collection** and **Cash Collections**, with a
   "No slip" filter.
2. Clicking a count opens a **drawer** that lists the day's slips, previews each one and offers a download.
3. **Add slip** is in the drawer. It covers a slip a store emailed in.
4. **Withdraw** is in the drawer too. It retires a wrong slip for good, and the slip moves to a
   **Withdrawn (n)** list.

There is no new route, menu leaf or router page (BackOffice 2030, F2/F3). The drawer opens over the two
existing grids.

**The seam is the contract.** Every ticket here calls a door that a BackOffice ticket of spec 2030 built. Both
of those tickets are **done**, and each records its envelope under its `## Web contract` heading:

- `C:\Work\DMSCO\BackOffice\.issues\2034-ready-and-collections-show-each-store-days-slip-count.md`
  covers the count, `cardTotal`, the column, the filter, the drawer, the preview and the download.
- `C:\Work\DMSCO\BackOffice\.issues\2035-finance-withdraws-a-wrong-slip-and-it-stops-being-readable.md`
  covers `uploadedBy`, `withdrawn`, `withdrawCategories`, Add slip and Withdraw. It is **added to** 2034's
  drawer and supersedes 2034 where they differ (the till column's "Web · \<uploadedBy\>").

Build and test against a stub of **exactly that shape**, and never invent a field. Before building,
cross-check the contract against the committed BackOffice code:

- `Sartawi.Retail.Data\Modules\Pos\Services\Models\Collection\CollectionReadyRowModel.cs`
- `CollectionInquiryModel.cs`
- `SlipCountedResponse.cs`
- `Services\SIS.Api\Endpoints\Attachments\AttachmentWebEndpoints.cs`
- `Services\SIS.Api\Endpoints\Pos\CollectionWebEndpoints.cs`

Record any drift in the ticket's comments.

| oms-react | BackOffice | What |
|---|---|---|
| 320 | 2034 | Ready and Cash Collections show each store day's slip count, and filter to "No slip" |
| 321 | 2034, 2035 | Clicking a count opens a drawer that lists, previews and downloads the day's slips |
| 322 | 2035 | Finance adds a slip from the drawer, and a retry never files it twice |
| 323 | 2035 | Finance withdraws a wrong slip, and it moves to Withdrawn |

## Decisions that cut across the tickets

- **Null is UNKNOWN, never "no slip".** A null `slipCount` draws a dash. It never counts as 0, never falls into
  the "No slip" filter, and never opens the drawer. The same holds for a null `cardTotal`: a dash, never
  `0.000`.
- **The `AttachmentWeb/Access` probe decides what is drawn, and it fails closed.** If `categories` lacks
  `CASH_CLOSE`, or the probe refuses (a 503 `NOT_SET_UP` until the File Server key exists), the column, the
  drawer and Add are all hidden. Withdraw also needs `withdrawCategories` to contain `CASH_CLOSE`. Read both
  lists with a strict membership test, never truthiness. The probe only governs what is drawn: the server
  checks the grant again on every call.
- **Two reads need the envelope's siblings.** `slipCountsUnavailable` sits beside `data` on Ready and
  Collections, and `withdrawn` sits beside `data` on `ByOwner`. Today `api.get` hands back `data` alone. The
  first ticket that needs a sibling (320) adds a read that keeps the envelope in `src/core/api.ts`
  (`api-envelope` rule), not a hand-rolled `fetch` beside the feature.
- **The owner key is `<storeId>/<yyyy-MM-dd>`**, built from the row's `storeId` and the date part of its own
  `businessDay`, by string handling. It never goes through a locale or through `new Date(...)`. One pure
  function owns it, and 321, 322 and 323 all call it.
- **Timestamps are local wall clock with no zone** (`storedAt`, `withdrawnAt`). Show them as they come. Never
  parse them through `new Date(...)` with a UTC reading.
- **Bytes go through `core/api.ts`.** Use `api.blob` for `/Content` and `api.upload` for the Add. The contract's
  `credentials: 'include'` is satisfied by the shared `send`: it is same-origin by design, and so is every call.
- **The drawer lives in `features/collection/inquiry/`.** Both grids that open it are there, and features never
  import features (`feature-structure` rule).
- **Wording.** The server's refusals are bilingual. Show `message` as it comes: English, then Arabic. The reason
  labels (323) are drafted English beside Arabic and wait on the owner's read, like every new string in spec 2030.

## Out of scope

- Every server, SIS.Api, till and DB change. Those are BackOffice's, and all of them are done.
- A standalone slip viewer, a new menu leaf or route, and a cross-store date-range view (BackOffice F2/F3).
- A restore for a withdrawn slip (C7). A withdrawn slip's bytes are not readable (C6).
- A cap on how many slips the accountant may add (C9).
- A collection cutoff. Add and Withdraw work the same on Ready rows and on collected Collections rows (C3).

## Deploy

oms-react goes **last**, after OMS DB script 003, the attachments grant seed on OMS-HQ, SIS.Api and the till.
Until the File Server production key exists (BackOffice 1962), the probe answers 503 `NOT_SET_UP` and every
slip surface stays hidden. That is correct, not a bug.
