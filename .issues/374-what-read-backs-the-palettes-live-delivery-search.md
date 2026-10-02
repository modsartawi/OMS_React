---
type: wayfinder-ticket
wayfinder: research
map: 358
status: done
blocked-by: —
---

# 374 — What read backs the palette's live delivery search

## Question

[364](364-what-the-command-palette-holds.md) ruled that the Ctrl+K palette carries a **debounced
live delivery search**. It matches delivery, document and order number exactly or by prefix, and
customer mobile exactly or by suffix, never by name. It is gated on `canOpenList` **and**
`canOpenDetail`. Which read can back it?

- **The existing list read.** Can `SdDocumentWeb/DeliveryDocumentList` serve it with a small
  `Limit` (around 8)? [360](360-what-the-delivery-reads-give-us.md) found that setting DeliveryNo,
  DocumentNo or OrderNo **drops the date range** and walks `DeliveryNo DESC`.
  - Are those three filters exact or `LIKE`?
  - Does a customer-phone filter exist, and is it indexed? `026_index_delivery_header_store_customer.sql`
    may cover it.
  - What does one keystroke cost when only the mobile is set?
- **If prefix or suffix is not cheap there:** what is the smallest BackOffice read that is? It
  must stay behind both OMS grant filters. Name the indexes it needs.
- **Should a hit row carry status from the list row,** with no detail read per hit?

Record what would have to be built, by whom, and its cost. Write the summary to
`assets/374-palette-search-read.RESEARCH.md` and link it from here.

## Answer

Researched on 2026-10-02 from code, schema scripts and BackOffice 1314's row counts. Dev SIS.Api was
down, so nothing was measured. **[Research note](assets/374-palette-search-read.RESEARCH.md).**

**The existing list read cannot back it.**

- `DeliveryDocumentList` matches DeliveryNo, DocumentNo, OrderNo and `CustomerPhone` **exactly**,
  with no `LIKE` anywhere. A phone filter exists, on the delivery's own `SdDocumentCustomer` row.
- The predicates are catch-all `(@P IS NULL OR col = @P)` with no `OPTION (RECOMPILE)`, under
  `TOP … ORDER BY DeliveryNo DESC`. The plan walks `PK_DeliveryHeader` backwards until `TOP` fills.
  - An exact number never fills 8, and the date range is dropped, so **one keystroke is a full walk
    of DeliveryHeader** (~6M rows, estimated).
  - A rare mobile does the same, with a `SdDocumentCustomer` seek per row.

**Indexes today.**

- **DeliveryNo:** the PK, so a prefix seek works.
- **RefDocumentNo:** 028's index, hand-run, prod application unconfirmed.
- **OrderNo on DeliveryHeader:** none.
- **`SdDocumentCustomer.CustomerPhone`** (20.9M rows): none. 026 is `(StoreCode, CustomerId)`,
  unapplied.
- The prod index set is unknown.

**Mobile suffix is the expensive rule.** `LIKE '%'+@q` scans 20.9M rows on every keystroke. Making
it seekable takes a persisted `REVERSE()` column and a second index. A 4-digit suffix also matches
about 2,000 strangers. **Recommendation:** match the mobile **exactly across its stored formats**,
`IN (05…, 9665…, +9665…)`, which is 3–4 seeks on one plain index. That amends 364, so it goes to
the owner: [What the palette's live search matches on and shows](376-what-the-palettes-live-search-matches-and-shows.md).

**The smallest cheap read: a new BackOffice route, `SdDocumentWeb/DeliveryQuickFind?q=&limit=8`.**

- **Gate:** ApiKey + **both** OMS grant filters chained (a third `GatedBy…` helper), so "list AND
  detail" is enforced by the server. Scope is the estate, the same as the list.
- **Dispatch:** the server classifies the term and runs only the branches that fit. Each branch is
  its own static, sargable `TOP 8` statement:
  - DeliveryNo prefix on the PK
  - RefDocumentNo prefix on 028
  - OrderNo prefix on a **new `IX_DeliveryHeader_OrderNo`**
  - mobile exact on a **new `IX_SdDocumentCustomer_CustomerPhone`**
- **Combining:** `UNION ALL`, then dedupe on DeliveryNo. Status lookups join only for the ≤ 8
  survivors.
- **Minimum term:** 4 characters.
- **Cost:** about 3–4 seeks plus tens of reads per keystroke, and a 250 ms debounce cancels stale
  requests through `signal` → `CancellationToken`.

**Yes, a hit carries status from the row, with no detail read per hit.**

- The payload is the numbers, `storeCode`, `entryTime`, `matchedOn`, the four status axes,
  `lastAction` and `deliveryType`.
- The label comes from 369's pure derivation in `@/core`, so the palette, the inspector and the
  timeline agree.
- There is no phone, no OTP, and by default no name. The prototype's name label goes to the 376
  grilling.

**What gets built, by whom.**

- **BackOffice:** route, classifier and branches, plus source-contract tests: **~1.5 dev-days**.
- **BackOffice / DBA:** two ONLINE index scripts in the 030 pattern, hand-run on `POS`, plus
  confirming 028: **~0.5 day plus a DBA window**. Before building, check the publisher's
  `sys.indexes`, the `DeliveryHeader` count, and a phone-format histogram (§6).
- **oms-react:** an `@/core/oms` `quickFind` and the hit row, inside the keyboard-layer step.
- **Until it ships,** Jump to number (no read) covers exact numbers. Live search follows as its own
  ticket, as Retry does in 370. The ask is filed with the others at `/to-spec`.
