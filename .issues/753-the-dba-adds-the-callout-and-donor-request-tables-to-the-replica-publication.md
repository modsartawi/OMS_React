---
type: wayfinder-ticket
wayfinder: task
map: 741
status: open
blocked-by: —
---

# 753 — The DBA adds the callout and donor-request tables to the replica publication

## Question

v1's fourth subject area (callouts and donor requests, ticket 745) has no source: on 2026-11-03 the
replica `172.23.27.47` / `POS` held no `Callout*`, `DonorRequest*` or `DeliveryCourierQuote` table.
The owner is the DBA and will add them as transactional articles. This ticket is done when they
are on the subscriber with recent rows.

**HITL checklist (owner as DBA):**

Must add. Every table has a primary key, as transactional replication requires. The schemas are
BackOffice `Sartawi.Retail.Data/Modules/Callouts/Sql/` and `Modules/Pick/Sql/`. The exception is
`DeliveryCourierQuote`, which is in `Modules/Sd/Sql/063_create_delivery_courier_quote.sql`.

**Ready to run:** [753-add-replica-articles.sql](assets/753-add-replica-articles.sql). It is a draft
for the publisher with steps 0–4:
- **0:** check `immediate_sync`, so the snapshot does not re-send `RetailTrxDetail`.
- **1:** add the articles.
- **2:** add the column filter.
- **3:** refresh the subscription and snapshot.
- **4:** run the count check.

Fill in the publication name.

- [ ] `Callout`: PK `CalloutId`. Includes `SearchRadiusKm` (script 007).
- [ ] `CalloutBid`: PK `BidId`.
- [ ] `CalloutEvent`: PK `EventId`.
- [ ] `DeliveryCourierQuote`: PK `DeliveryNo`. The dispatch scorecard joins it.
- [ ] `DonorRequest`: PK `RequestNo`.
- [ ] `DonorRequestLine`: PK `(RequestNo, DeliveryLine)`.
- [ ] `DonorRequestEvent`: PK `(RequestNo, Seq)`.

Optional dimensions, which are small:
- [ ] `CalloutCourierStoreReason`: PK `Reason`.
- [ ] `ServingList`, `ServingListStore` and `ServingListChange`.

**Free text that may hold personal data.** Your choice: column-filter these out of the articles.
The semantic model never declares them either way.
- `Callout.ReleaseNote`
- `DonorRequestEvent.Reason`
- `DonorRequestEvent.Detail`
- `DonorRequestEvent.ComplaintRef`
- `CalloutEvent.Detail`, added 2026-11-04. Script 005 made it NVARCHAR(300) because it "holds a
  pharmacist's or courier's words".
- `ServingListChange.Note`, added 2026-11-04. It is NVARCHAR(500) human text and matters only if
  that optional dimension is added.
- Consider `DeliveryCourierQuote.ErrorMessage` too: it is courier API error text.

**Not tables:** `DispatchBoardRelease`, which 750's missing list names, is only a screen
authorization in BackOffice. Releases are columns on `Callout` (`ReleasedAt`, `ReleaseReason`).

**Already on the replica, so no action:**
- `DeliveryHeader`, `DeliveryLine`
- `SdDocumentLog`, `SdDocumentHeaderStatus`, `SdDocumentSource`
- `Store`, `StoreArea`, `BusinessAddress`

**Verify after the snapshot.** Run this through the sanctioned `sqlcmd` shape:

```sql
SELECT 'Callout', COUNT(*), MAX(OpenedAt) FROM Callout
UNION ALL SELECT 'CalloutBid', COUNT(*), MAX(OfferedAt) FROM CalloutBid
UNION ALL SELECT 'DonorRequest', COUNT(*), MAX(RaisedAt) FROM DonorRequest;
```

**Resolved when** the articles are live and the counts match the publisher. Record:
- the snapshot date;
- whether the free-text columns were filtered;
- the count check.

## Progress

- **2026-11-04 00:18, subscriber check, not resolved.** The agent queried the replica through the
  sanctioned door; TCP 1433 was reachable. None of the 11 tables exist yet (`sys.tables` had no
  `Callout%` or `Donor%` match), so the articles have not been published.
  - The session wrote the publisher script linked above. It found two free-text columns the first
    list missed and the correct `DeliveryCourierQuote` schema path. Both are folded into the body.
  - The ticket goes back to `open`. Once the owner has run the script, any session can take it and
    run step 4's check on the subscriber.
- **2026-11-04 23:18–23:20, the articles are on the subscriber and replicating; ready to close.** The
  owner (acting DBA) published them from the server, and the snapshot landed 2026-11-04 23:16:08.
  - **All 7 must-add tables exist,** with these row counts at 23:18: `Callout` 1,975, `CalloutBid`
    12,724, `CalloutEvent` 83,505, `DeliveryCourierQuote` 2,861, `DonorRequest` 2,783,
    `DonorRequestEvent` 8,657, `DonorRequestLine` 3,283.
  - **Live:** `CalloutEvent` went 83,505 → 83,509 → 83,517 over about 90 s. The latest `Callout` and
    `CalloutBid` rows are from 23:18:17, after the snapshot. The latest `DonorRequest.RaisedAt` is
    23:06:45.
  - **The optional dimensions were not added:** `CalloutCourierStoreReason` and `ServingList*`.
  - **The free-text columns were not filtered.** `Callout.ReleaseNote`, `CalloutEvent.Detail`,
    `DonorRequestEvent.Reason`, `.Detail` and `.ComplaintRef`, and
    `DeliveryCourierQuote.ErrorMessage` are all on the subscriber. That is allowed: the semantic
    model never declares them, and 757's dbt models must not select them into any mart.
  - **Owed to close:** the publisher-side counts for step 4. The sanctioned door reaches only the
    subscriber. Once the owner reports them, any session can close this.
