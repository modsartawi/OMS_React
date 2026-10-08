---
type: spec
status: ready
---

# 430 — OMS gains Donor requests, Document payments, Failed donor transfers, Cities & districts and Document source users

Settled in the 2026-10-07 `/grill-with-docs` session. The vocabulary is `CONTEXT.md`'s: **donor
request**, **donor moment**, **failed donor transfer**, **reverse by hand**, **re-run**, **document
payment**, **district**, **document source user** (the last six minted in that session). Decisions
D1–D20 below are this file's own.

**The seam is the contract.** Not one of these five screens has a browser door today. Every
read and write the WPF screens use is `x-api-key` only (closed to a cookie session since BackOffice
802), except the city and district **reads**, which are cookie-open but carry no grant. The owner
ruled (grill Q2) that **one BackOffice spec owns all the doors and their shapes**; this spec is its
web half. The shapes in D2–D7 are this side's **proposal** to that spec. Build and test against a
stub of exactly those shapes, never invent a field beyond them, and re-point at whatever the
BackOffice spec settles if it differs. The asks are listed as BO-1…BO-7 under Further Notes, **not
filed yet**.

## Problem Statement

OMS back-office users work in two places. The delivery list, the delivery's details and its
timeline are on the web. Everything around them is still in the WPF BackOffice:

- **Donor requests.** An HQ or area lead who wants to know "which donor asks are open, refused or
  expired across the estate right now?" has no screen for it. The web shows a request only as donor
  moments on **one** delivery's timeline (ticket 429). The WPF HQ donor tab (BackOffice 1788) is a
  mispick-inquiry pane, not a place to work from.
- **Document payments.** Finance and OMS-payments users look up how an order or delivery was paid
  (type, method, card, amount, reference, invoice) in the WPF *Document Payment Inquiry*, then
  switch to the web to open the document.
- **Failed donor transfers.** HQ inventory's work queue of failed and retrying DRTR jobs, and of
  cancelled requests whose transfer posted anyway, lives only in WPF (BackOffice 2372). That
  includes the re-run of a failed job.
- **Cities, districts and document source users.** The shared geography that routes an order to
  its store, and the pins of staff users to a document source, are read and imported only through
  WPF. The WPF import is a tab-separated file applied line by line. It **silently skips** a line it
  cannot apply (an unknown city, an unknown staff ID or source), so the operator believes it worked.

The result is a user switching applications mid-task, and a second client to keep alive for five
screens.

## Solution

Five new leaves in the **OMS** menu group, each its own screen under `/oms/*`, each behind its own
grant:

1. **Donor requests** (new design, no WPF original). A cut-down version of the Deliveries screen:
   simple filters (state, donor store, order store, raised-date range), a grid, a read-only
   inspector beside it that shows the selected request's donor moments, and a click-through to the
   request's delivery.
2. **Document payments.** The WPF inquiry's filters and columns, opening a row's document or
   delivery in Document Details, with an xlsx export.
3. **Failed donor transfers.** The WPF work queue: each line says what it asks of HQ. A failed line
   can be re-run (its own grant, after a confirmation), and a reverse-by-hand line names the STO to
   reverse in DRS. Lines link to their donor request and delivery.
4. **Cities & districts.** One screen with cities on top. Selecting a city lists its districts
   below. Each list can be exported and imported.
5. **Document source users.** The list of users and their document source, exportable and
   importable.

Imports keep the WPF file format, so existing files and habits still work. They gain a **preview**
that shows what each line will do before anything is sent, and a **result** that names every line
the server skipped and why.

## User Stories

### Donor requests

1. As an HQ OMS lead, I want an OMS leaf "Donor requests", so that I can see donor asks across all stores without opening deliveries one by one.
2. As an HQ OMS lead, I want the list to open on today's raised requests, so that the first view is the live day and not an unbounded history.
3. As an HQ OMS lead, I want to filter by state (open, fulfilled, transferred, cancelled), so that I can look at only the requests still waiting.
4. As an HQ OMS lead, I want to filter by donor store, so that I can see what one store has been asked to give.
5. As an HQ OMS lead, I want to filter by order store, so that I can see what one store has asked for.
6. As an HQ OMS lead, I want to filter by a raised-date range, so that I can review a past day or week.
7. As an HQ OMS lead, I want each row to show request no, delivery no, donor store, order store, state, outcome and its reason, units asked and units given, so that I can read the request without opening it.
8. As an HQ OMS lead, I want each row to show when it was raised, picked and ended, so that I can see which asks are stale.
9. As an HQ OMS lead, I want a refused or expired request to stand out (attention tone) and a cancelled one to be muted, so that the rows needing a decision catch my eye. These are the tones the delivery timeline already uses.
10. As an HQ OMS lead, I want a request that was cancelled after its units were picked to be marked as such, so that I can tell a clean cancel from one that left stock in motion.
11. As an HQ OMS lead, I want an open, unpicked request to show how long it has been waiting, so that I can chase the donor.
12. As an HQ OMS lead, I want to select a row and see its donor moments (raised, edited, picked, stamped, transferred, ended) in a read-only inspector beside the grid, so that I get the request's story without leaving the list.
13. As an HQ OMS lead, I want stepping through rows to be instant, so that reviewing a day's requests is not a wait per row. The inspector draws from the row alone and never fetches.
14. As an HQ OMS lead, I want to open the request's delivery in Document Details from the row and from the inspector, so that I can act on the delivery itself.
15. As an HQ OMS lead, I want the transfer's STO and SAP document number shown once the request is transferred, so that I can trace the stock movement.
16. As an HQ OMS lead, I want the row count shown, and a clear "showing the first N" when the server's limit cut the list, so that I never mistake a capped list for the whole answer.
17. As an HQ OMS lead, I want to export the list I am looking at to xlsx, so that I can share it.
18. As a user without the donor-requests grant, I want the leaf hidden, and a direct URL to show the standard denied card, so that the screen never half-renders.

### Document payments

19. As an OMS payments user, I want an OMS leaf "Document payments", so that I can look up how a document was paid on the web.
20. As an OMS payments user, I want the from/to date to default to today, so that the screen opens on today's payments.
21. As an OMS payments user, I want to filter by store, document type, customer phone, document no and order no, so that I can find a payment by whatever the customer gives me.
22. As an OMS payments user, I want to paste a list of document numbers or order numbers (from an Excel column, comma or space separated), so that I can check many at once.
23. As an OMS payments user, I want to be told before searching when my pasted list holds more than 1,000 numbers in total, so that I can shorten it instead of getting a server refusal.
24. As an OMS payments user, I want a result limit (default 200), so that a broad search stays fast. When the limit cut the list, I want the screen to say so.
25. As an OMS payments user, I want each row to show order no, document type, payment type, method, card type, amount, currency, reference number, store, entry time, mobile, delivery type, delivery no, delivery note and delivery status, so that I get everything the WPF screen showed.
26. As an OMS payments user, I want the amount shown as money in its currency, so that I don't misread it.
27. As an OMS payments user, I want to open the row's document in Document Details, so that I can see the whole order.
28. As an OMS payments user, I want to open the row's delivery in Document Details when it has one, with no such action on a row without a delivery, so that I don't hit a dead link.
29. As an OMS payments user, I want to export the result to xlsx, so that I can reconcile it.
30. As a user without the payments grant, I want the leaf hidden and the URL denied, so that customer phone numbers and names are not exposed. The rows carry both.

### Failed donor transfers

31. As an HQ inventory user, I want an OMS leaf "Failed donor transfers", so that I can work the queue on the web.
32. As an HQ inventory user, I want the list to load when I open the screen, so that I see the current queue at once. It is a work queue, not a history.
33. As an HQ inventory user, I want each line to show request, delivery, donor store, order store, request state, job state (failed / retrying / completed), attempts, last attempt, retry deadline, STO, reverse-by-hand and DRS's last error, so that I have everything the WPF screen showed.
34. As an HQ inventory user, I want each line to say what it asks of me ("Re-run once the cause is fixed", "Retrying on its own", "Reverse STO … in DRS"), so that I don't have to infer it from the flags.
35. As an HQ inventory user, I want to filter the loaded lines by donor store, order store and last-attempt date range, so that I can take my share of the queue. A reverse-by-hand line with no attempt time is never hidden by the date filter.
36. As an HQ inventory user holding the re-run grant, I want a Re-run action on a failed line only (never on a retrying or reverse-by-hand line), so that I cannot fight the outbox processor or re-post stock that already moved.
37. As an HQ inventory user, I want Re-run to ask me to confirm, naming the request, so that I don't post stock by a stray click.
38. As an HQ inventory user, I want Re-run to tell me whether the transfer posted, or why it did not finish, so that I know the outcome.
39. As an HQ inventory user, I want the list to reload after every re-run, whatever its answer, so that the line's state is the server's.
40. As an HQ inventory user, I want a re-run that does not answer in time to say "it may still be running; reload in a minute" and not "failed", so that I don't re-run it twice.
41. As an HQ inventory user, I want a failed reload after a re-run to leave the list as it was, so that I don't lose the run's answer.
42. As an HQ inventory user, I want to open the line's donor request (on the Donor requests screen) and its delivery (in Document Details), so that I can see the context.
43. As an HQ inventory user without the re-run grant, I want no Re-run action at all, so that I am not offered something that will be refused.

### Cities & districts

44. As an OMS store-config user, I want an OMS leaf "Cities & districts", so that I can read the geography on the web.
45. As an OMS store-config user, I want the cities listed with code, English name, Arabic name and last change, so that I can check a city.
46. As an OMS store-config user, I want selecting a city to list its districts below, with code, English and Arabic names, Magento city names, store, insurance store, temporary store, latitude/longitude and last change, so that I can check which store serves a district.
47. As an OMS store-config user, I want to filter each list by text, so that I can find one city or district in hundreds.
48. As an OMS store-config user, I want to export cities and districts to xlsx, so that I can edit them offline.
49. As an OMS store-config user holding the import grant, I want to import cities from the same tab-separated file as WPF (`code, English name, Arabic name[, X]`), so that my existing files still work.
50. As an OMS store-config user holding the import grant, I want to import districts from the same file as WPF (`code, city code, English name, Arabic name, Magento city EN, Magento city AR, store, insurance store, temporary store[, X]`), so that my existing files still work.
51. As an importing user, I want to pick a file or paste the rows, so that I can import straight from Excel.
52. As an importing user, I want a preview listing each line as *add/update* or *delete* with its fields, so that I can see what will happen before I send it.
53. As an importing user, I want a line with the wrong number of columns flagged in the preview and the import blocked until it is fixed, so that a shifted column never writes a wrong store.
54. As an importing user, I want a header row (or any line that cannot be applied) visible in the preview, so that I catch it before it becomes a city named "CityCode".
55. As an importing user, I want the result to say how many lines were applied and list every line the server skipped and why (unknown city, unknown staff ID, unknown document source), so that nothing is skipped silently.
56. As an importing user, I want the lists to reload after an import, so that I see the new state.
57. As a user without an import grant, I want no Import action, so that I am only offered what I can do.

### Document source users

58. As an OMS admin, I want an OMS leaf "Document source users", so that I can see which staff users are pinned to which document source.
59. As an OMS admin, I want each row to show user ID, document source, and who last changed it and when, so that I can audit the pins.
60. As an OMS admin, I want to filter by user or source and export to xlsx, so that I can review the pins.
61. As an OMS admin holding the import grant, I want to import the WPF file (`user ID, document source[, X]`), with the same preview and the same skipped-lines result, so that I can pin or unpin users in bulk.

### Cross-cutting

62. As an Arabic user, I want every screen mirrored, with store codes, numbers, dates, ranges and counts isolated, so that nothing reads backwards.
63. As any user, I want a server refusal on any of these screens shown with its own message, so that I know what went wrong.
64. As an OMS user, I want the OMS menu group to cost one access check, not one per leaf, so that the menu draws at once.

## Implementation Decisions

### Shape and placement

- **D1 — Five features in the `oms` area,** each a folder under `features/oms/` with its own Page,
  `api.ts` and i18n namespace (namespace == feature name, registered centrally, with English and
  Arabic strings):

  | Feature (namespace) | Route | Menu leaf |
  |---|---|---|
  | `donor-requests` | `/oms/donor-requests` | Donor requests |
  | `document-payments` | `/oms/document-payments` | Document payments |
  | `failed-donor-transfers` | `/oms/failed-donor-transfers` | Failed donor transfers |
  | `geography` | `/oms/geography` | Cities & districts |
  | `document-source-users` | `/oms/document-source-users` | Document source users |

  Features never import each other. Cross-links (failed line → donor request, any row → delivery)
  are **navigation by route**, never an import. A failed line opens the donor list filtered to its
  request through a URL search param (`?request=<no>`). The donor list reads that param once to
  seed its criteria.

### The doors (proposal to the BackOffice spec)

All are `SdDocumentWeb/*`: cookie session plus a per-screen grant filter, the same family as the
delivery doors. Response envelope as usual. A 403 from a grant filter is the usual business
refusal. Names are proposals; the BackOffice spec settles them.

- **D2 — Access probe, extended.** `SdDocumentWeb/Access` gains flags. It stays the **one**
  OMS probe and the **one** shared cache entry (the menu's OMS group and every OMS page guard
  read it), and it still fails closed. **An absent flag reads as false**, so this side ships
  before the server learns the flags and simply hides the leaves.

  ```
  canOpenDonorRequests        // new grant DonorRequestInquiry, 03
  canOpenDocumentPayments     // DocumentPaymentInquiry, 03
  canOpenFailedTransfers      // FailedDonorTransfers, 03
  canReRunFailedTransfer      // FailedDonorTransfers, 06
  canOpenGeography            // SdCityInquiry, 03  OR  SdDistrictInquiry, 03
  canImportCities             // SdCityImport, 03
  canImportDistricts          // SdDistrictImport, 03
  canOpenDocumentSourceUsers  // DocumentSourceUsersInquiry, 03
  canImportDocumentSourceUsers// DocumentSourceUsersImport, 03
  ```

  The legacy grants are the existing WPF controller IDs. That keeps the production role mapping:
  `OMS_PAYMENTS` and `OMS_STORE_CONFIG` already hold them. Only `DonorRequestInquiry` is new.

- **D3 — Donor request list.** `GET SdDocumentWeb/DonorRequests?store=&donorStore=&orderStore=&state=&fromDate=&toDate=&limit=`.
  - It is the cross-store read behind the WPF `Mispick/DonorRequests`, plus the **state filter**
    that read lacks.
  - `fromDate`/`toDate` apply to `raisedAt`; `toDate` is inclusive.
  - `state` is a repeated key, meaning any of the given states.
  - Rows are **`DonorRequestModel`, the same shape as 2458's per-delivery door** (already in
    `@/core/models`). That lets the inspector reuse `@/core/oms` donor moments unchanged and draw
    from the row alone.
  - The answer is `{ rows, limited: boolean }`, where `limited` means the server's limit cut the
    list.
  - `minutesToFulfil` and the cancelled-after-fulfilled flag are **derived on this side** from the
    row's times. They are not asked of the server.

- **D4 — Document payments.** `GET SdDocumentWeb/DocumentPayments` takes the WPF query unchanged
  (`StoreCode, CustomerPhone, FromDate, ToDate, Limit, OrderNo, DocumentNo, DocumentType`). Rows
  are `DocumentPaymentModel` as WPF reads it. The answer is `{ rows, limited }`. The server keeps
  its 1,000-value ceiling on the two number lists. Its refusal code (proposed `TOO_MANY_VALUES`) is
  shown with its message.

- **D5 — Failed donor transfers.**
  - The read is `GET SdDocumentWeb/FailedDonorTransfers`, rows `FailedDonorTransferRow` (no
    filters, a work queue).
  - The run is `POST SdDocumentWeb/FailedDonorTransfers/{outboxId}/Run`, which answers the outbox
    manual-run result `{ success, error }`. It is behind the 06 grant.
  - The server refuses a run on a line that is not FAILED or is reverse-by-hand (proposed
    `NOT_RERUNNABLE`), even though the client never offers one.

- **D6 — Geography.**
  - The reads are `GET SdDocumentWeb/Cities` and `GET SdDocumentWeb/Districts?cityCode=`, now
    grant-gated (the cookie-open `SdDocument/*` reads are left alone for their existing callers).
  - The imports are `POST SdDocumentWeb/Cities/Import` and `POST SdDocumentWeb/Districts/Import`.
    Bodies are the WPF `{ lines: [...] }` with `isDelete`.

- **D7 — Document source users.**
  - The read is `GET SdDocumentWeb/DocumentSourceUsers`.
  - The import is `POST SdDocumentWeb/DocumentSourceUsers/Import`, body `{ lines: [{ userId, documentSource, isDeleted }] }`.
    The server's field is `isDeleted`, not `isDelete`. This side maps to it and never renames it.

- **D8 — Every import answers what it skipped.** This is the one behavioural change from WPF.
  The three import doors answer:

  ```
  { applied: number, unchanged: number,
    skipped: [{ line: number, key: string, reason: 'UNKNOWN_CITY' | 'UNKNOWN_STAFF' | 'UNKNOWN_SOURCE' | string }] }
  ```

  `line` is the 1-based line of the file as sent. An unknown reason code is shown as the code
  itself and is never dropped. Semantics stay the WPF ones: per-line upsert or delete, one commit,
  lines absent from the file untouched.

### Screens

- **D9 — Donor requests is the Deliveries layout cut down.**
  - It has a filter bar, the grid, a resizable read-only inspector and a status bar with the count.
  - It has **no** query-token bar, saved views, lenses or view rail.
  - Criteria live in a small pure module, `criteria → query params`. The default is today, all
    states, no store.
  - The "waiting" elapsed time and the tones come from `@/core/oms` (`waitingOnDonor`,
    `donorOutcome`, `elapsedSince`).
  - The inspector shows the request's header facts, then its donor moments newest first, then
    "Open delivery".
  - **The inspector's presentation is new, not lifted from the delivery timeline.** Delivery
    timeline components live in the `document` feature and may not be imported. Only the pure
    `@/core/oms` functions are shared.

- **D10 — Opening a delivery or document** uses the existing Document Details routes and the
  `@/core/oms` open-intent. The payments row opens `DocumentNo` as a document. It opens
  `DeliveryNo` as a delivery only when it is set.

- **D11 — Document payments criteria.**
  - The number boxes are counted with the core code-list splitter. It uses the same separators as
    the server's `MultiValueFilter`: `, ; |`, space, `\r \n \t`.
  - Over 1,000 values in total across both boxes is refused before the call, and the message names
    the count.
  - The text is sent as typed; the server splits it again.
  - The document-type dropdown reads the existing cookie-open `SdDocument/DocumentTypes` lookup.

- **D12 — Failed donor transfers line model,** a pure module lifted from WPF
  `FailedDonorTransferLine`. It computes the job label (FAILED→failed, PENDING→retrying,
  COMPLETED→completed, otherwise the raw status) and `canReRun`:
  - not reverse-by-hand
  - **and** the job is FAILED
  - **and** an outbox ID is present
  - **and** the user holds the re-run grant

  It also gives the action sentence and the client-side filter. An unset time (`0001-…`) is blank
  and passes the date filter. Re-run confirms in the app's modal (never a browser dialog). Its
  outcome is a toast. The reload afterwards goes through the query cache, and a failed reload
  keeps the last good list. A timeout or network failure on the run says "may still be running",
  not "failed".

- **D13 — Cities & districts.**
  - Cities sit in the upper grid and the selected city's districts in the lower one. Districts
    load per city on selection.
  - Each grid has its own text filter (AG Grid quick filter) and export.
  - Import is one dialog per list, offered only with its grant.

- **D14 — The import dialog is one shared shape across three features.** Its **parser and preview
  model** (a pure module: text → lines → `{ action: 'upsert' | 'delete', fields } | { error }`)
  is generic over a column spec, so it graduates to `@/core/` (two features use it). Each feature
  supplies its column spec.
  - Rows are split on `\r?\n`, with empty lines dropped.
  - Columns are split on `\t`.
  - A trailing `X` (case-insensitive) is a delete.
  - Column count must equal the spec's, or the spec's plus one when the extra is `X`. Otherwise
    the line is an error and Send is disabled.
  - No header skip: a header line shows in the preview as an ordinary line, so the user sees it.
  - City codes are not upper-cased on this side, because the server does it.

- **D15 — Every grid** spreads the core grid base. Exports go through the core xlsx writer (which
  strips isolates). Money uses the core money formatter. Store codes, numbers, dates and ranges are
  isolated per the bidi rule. Free text (names, error messages, delivery notes) uses `<bdi>`.

- **D16 — Data loading.** Each Page wraps its `api.ts` in TanStack Query. Lists load on Search,
  except Failed donor transfers and the geography and source-user lists, which load on open. Their
  data is small or a live queue.

- **D17 — Errors.** Every failure goes through `apiErrorMessage`. The machine codes branched on
  are `TOO_MANY_VALUES` (payments), `NOT_RERUNNABLE` (re-run, which reloads the list), and the
  skipped-line reasons (import). 401 is not handled here.

### Menu

- **D18 — Five new leaves in the OMS group,** after Deliveries and Central invoicing, each gated
  on its D2 flag. The order is Donor requests, Failed donor transfers, Document payments, Cities &
  districts, Document source users. All read the one OMS probe entry, so the group still costs one
  call.

### Dropped from WPF

- **D19 — Not carried over:**
  - the dead `SdDistrictLookup` screen (0 grants)
  - the never-wired inquiry "Import" buttons (imports were their own menu items in WPF; here they
    are an action on the inquiry)
  - the payments screen's empty "Wasfaty refill" command
- **D20 — Document source users stays read and import only.** There is no single-row edit,
  because WPF had none.

## Testing Decisions

- **A good test checks behaviour through a pure module's public function:** given criteria, rows
  or file text, assert what the user would see or what goes on the wire. It never asserts
  component internals. Screens stay thin renderers of those modules.
- **Tier 1, vitest (pure, in-memory). This is the main seam.**
  - donor list criteria → query params (default today; repeated `state`; inclusive `toDate`;
    `?request=` seeding)
  - the donor row model (waiting elapsed, outcome tone, cancelled-after-picked, minutes to pick),
    over the existing donor-moments helpers
  - payments criteria (1,000-value guard counted across both boxes with the shared separators; the
    open-document / open-delivery offer)
  - the failed-line model (job label, `canReRun` truth table including the grant, action sentence,
    filter with the unset-time rule)
  - the core import parser (column counts, `X` delete, errors block send, header shown as a line,
    CRLF/LF, empty lines) and the import result → message model (applied/unchanged/skipped, an
    unknown reason kept)
  - the access-probe flag reader (an absent flag is false)
- **Tier 3, Playwright drives (manual-run), one per screen,** stubbing the envelopes **exactly**
  as D2–D8, in LTR and RTL:
  - donor list: filter, select, inspector, open delivery
  - payments: guard message, open document/delivery, export
  - failed transfers: re-run confirm → posted / did-not-finish / no-answer → reload; no Re-run
    without the grant
  - geography: city → districts, import preview with an error line, skipped-lines result
  - source users: import
  - the menu: leaves hidden per flag
- **No RTL (React Testing Library).** It is still not installed (spec 083's ruling). Components are
  verified by the drives.
- **Prior art:**
  - `@/core/oms/donor-moments.test.ts` and the deliveries `inspector-model.test.ts` (row → inspector)
  - ua-admin `bulk-create.test.ts` (file → lines → preview)
  - `@/core/util/code-list.test.ts` (separators)
  - `tools/document-donor-drive.mjs` (stubbed donor envelopes)
  - the collection drives (stubbed `*Web` doors)
- **Gates per ticket:** `npm test`, `npm run typecheck`, `npm run lint`, the screen's drive.

## Out of Scope

- Any write on a donor request (cancel, edit, re-raise). The list is read-only.
- Saved views, lenses, the query-token bar and live search on the donor list.
- Reversing an STO in DRS. The screen names it; the reversal stays in DRS.
- Single-row create/edit/delete of cities, districts or source users. Only file import, as in WPF.
- A replace-all import. Lines absent from the file stay untouched, as in WPF.
- `OrderPaymentInquiry` (the other `OMS_PAYMENTS` screen). It was not asked for.
- Retiring the WPF screens. That is BackOffice's call once these are live.
- The BackOffice doors themselves (the BackOffice spec).

## Further Notes

- **BackOffice asks (not filed; the one BackOffice spec owns them).**
  - BO-1: the access-probe flags (D2).
  - BO-2: the donor request list door with a state filter, returning the 2458 row shape (D3), plus
    the new `DonorRequestInquiry` grant.
  - BO-3: the payments door (D4).
  - BO-4: the failed-transfers read and run doors (D5).
  - BO-5: the gated geography reads and the imports (D6).
  - BO-6: the source-users read and import (D7).
  - BO-7: the skipped-lines import answer (D8). This changes the shared service, so the WPF imports
    gain it too.
- **2458 has shipped** (BackOffice, done), so ticket 429's live walk on a pilot-store delivery is
  unblocked. It is not part of this spec.
- Document source users belongs to no role today (4 production grants). The BackOffice spec should
  say which role gets `DocumentSourceUsersInquiry`/`Import`.
- The district import skips a line whose city does not exist, **deletes included**. With BO-7 that
  skip is reported. It is not changed.
- `FailedDonorTransfers` is seeded for ADMIN only (`046_seed_failed_donor_transfers_menu.sql`). HQ
  inventory needs the grant before the web leaf appears for them.
