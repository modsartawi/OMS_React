---
type: wayfinder-ticket
wayfinder: research
map: 793
status: done
blocked-by: —
---

# 804 — Which document sources and states define QC and a cancelled order?

## Question

The owner's worked example (map 793 Notes) compares HungerStation with **QC** and shows each one's
**cancellation rate**. v1's model has neither. Find the facts that 796 needs to define them:
- **QC:** what QC means in the OMS (quick commerce, a partner, an order type), which
  `SdDocumentSource` / `DocumentSource` values carry it, and where it falls in v1's five channel
  groups (`docs/research/741-v1-semantic-model.md`). Say whether it needs its own group or a finer
  dimension below the groups.
- **Cancelled:** which document states, log events (`SdDocumentLog`) or status fields mark an
  order as cancelled; whether a cancellation by the customer, the store and the partner are told
  apart; and what the existing OMS screens and BackOffice statistics (ADR 0081, the store
  statistics doors) already count as cancelled, so the measure matches them.
- **The rate:** the numerator and denominator, and which date a cancelled order belongs to (order
  date or cancellation date).

Sources: the BackOffice code (`C:\Work\DMSCO\BackOffice`, read-only), this repo's deliveries and
statistics screens, and `CONTEXT.md`. Replica checks are optional and read-only through the
sanctioned `sqlcmd` shape; if the corporate network is not reachable, answer from the code and mark
the counts as owed. Notes go in `docs/research/804-qc-and-cancellation.md`.

## Answer

Done 2026-11-06 (AFK, replica reached, week 2026-10-25 → 10-31). Notes:
[804-qc-and-cancellation.md](../docs/research/804-qc-and-cancellation.md). Facts only. Each
recommendation is 796's to take or reject.

- **QC is Quick Commerce ("Dawaa Now"), express delivery carried by OTO.** It is a **delivery type**
  (`DeliveryHeader.DeliveryDocumentType = 'QC'`), not a document source and not an order type. The
  order header does not carry it. All 3,952 QC deliveries in that week came from `IOS`/`WEB`/`ROID`
  and were express, so QC falls entirely inside v1's `own_app_web` group. **Recommended:** a
  delivery-type dimension (or QC flag) below the groups, not a sixth group.
- **Cancelled = a terminal close.** No status reads "cancelled". `CloseStatus` `C`/`X`/`N` (`F`
  is defined but never written). The log shows `DCLS`/`DFCL`/`DCNI`/`DCAD` after `DRCL` on a
  delivery, and `OCLS`/`OFCL` after `ORCL` on an order. Once an order has a delivery, the
  cancellation lives **only on the delivery**.
- **Who cancelled:** no reason codes (`ReasonCode` is hard-coded `""`, 0 of 11,168 set). Only the
  request-close row's `EntryUser` tells: `AutoClose` = expiry, `PH` = store till, `Outbox` = courier,
  `BJ_SYSTEM` = platform, anyone else = a person or the app.
- **The predicate to match** is the store statistics `ClosedOrCancelled` (ADR 0081). It counts a
  delivery once, on the day of its first `DCLS`/`DFCL`/`DCNI`/`DCAD`. The till, the
  `SdDocumentWeb/StoreStatistics` door and the Delivery Statistics screen all read the same rows.
- **The rate (recommended):** order grain, every order in the denominator, dated by the order's
  `EntryTime`. Split the numerator into *cancelled* (any requester but `AutoClose`) and *expired*
  (`AutoClose`). Leave out `N` (those deliveries were in fact delivered). Caveat: about half of all
  closes are expiries that land on day 8, so a recent order-dated rate stays incomplete for about 8
  days.
- 🚩 Store statistics count `DCNI`/`DCAD` as both delivered and closed. HungerStation shows 25 closes
  in 21,361 deliveries, all expiries: its platform cancellations live in
  `DhOrderHeader.Status = 'CANCELLED'`, which is **not on the replica**. The replica's
  delivery-type lookup has no QC row. The v1 `channel_map.csv` misses the `COBE`/`COBC`/`CFLO`
  call-centre sources (about 7.4k orders a week land in `other`).
- **Owed:** HungerStation's platform-cancel count from the OMS application database, and whether those
  orders ever get an OMS document. Confirming that the dominant "other" requester on IOS/ROID is the
  app. The missing QC lookup row. Whether `JAHA` (95 orders under `INSP`) is Jahez.
