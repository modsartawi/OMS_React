---
type: wayfinder-ticket
wayfinder: grilling
map: 741
status: done
blocked-by: —
---

# 745 — Which subject areas, measures and questions does v1 answer?

## Question

What does the v1 semantic model cover?

Pin down:
- **The subject areas, ranked.** Candidates:
  - till sales ("value through our tills", never revenue: 723's caveat);
  - orders by channel;
  - delivery speed and dispatch, including callouts;
  - insurance;
  - loyalty share.
- **The measures and dimensions** of the first one or two areas, each with its exact business
  definition. Examples: closed = `TrxStatus = 1`; returns are `TrxType 110`; BHD × rate → SAR; the
  placeholder loyalty ids are excluded; dates are capped at today.
- **Ten to fifteen real questions** that HQ users ask today and that v1 must answer.
- **What v1 must not answer.**

Use the real questions as the seed of the AI's evaluation set. Reuse spec 734's vocabulary and
D2's tool definitions where they overlap. A measure that also exists as a 734 tool must have **one**
definition.

## Answer

**Settled with the owner, 2026-11-03.** The full catalogue (every measure's definition, the
dimensions, the fifteen questions mapped to measures, and the must-not-answer list) is
[741-v1-semantic-model.md](../docs/research/741-v1-semantic-model.md).

- **v1 has four areas, ranked:**
  1. till sales, with loyalty share, Bahrain and NPHIES-linked sales as slices;
  2. orders by channel;
  3. delivery speed;
  4. callouts and donor requests.
  The owner overruled "delivery and dispatch out of v1".
- **Delivery speed is measurable on the replica,** which corrects 723. `SdDocumentLog` carries
  first events for about 110 k deliveries a week, and `DeliveryHeader` stamps are real, with
  `0001-01-01` meaning unset. Times follow BackOffice ADR 0081's first-event rule.
- **Callouts and donor requests are not on the replica at all.** The owner, acting as DBA, will add
  the articles:
  [The DBA adds the callout and donor-request tables to the replica publication](753-the-dba-adds-the-callout-and-donor-request-tables-to-the-replica-publication.md).
  Area 4 waits on it; nothing else does.
- **Definitions:**
  - **Till sales** are counted at header grain, and v1 has no product dimension.
  - **Net till value SAR** = sales `Amount×rate` minus returns `Amount×rate`. It is always worded
    "value through our tills".
  - **Placeholder loyalty ids** are excluded, `TrxType 700` never counts, and dates are capped at
    today.
  - **Channel** is a `DocumentSource` → five-group map.
  - **Weeks** start on Sunday.
  - **Callout measures** are SQL twins of `DispatchScorecardMath`, accepted by a parity check
    against the scorecard door.
  - **Donor fill time** = `FulfilledAt − RaisedAt`.
- **Fifteen real HQ questions** were accepted as the must-answer set and the evaluation seed. They
  include 734's demo story 2. Q11–Q13 wait on 753.
- **v1 must not answer:**
  - anything per customer, per loyalty member or per staff member;
  - revenue, margin or cost;
  - product mix;
  - forecasts;
  - insurance approvals;
  - SAP, IDocs or coupons;
  - free-text contents;
  - single-order lookups, which stay with 734's tools.
- **One definition with 734:** `sales_summary`, `orders_by_channel` and `callout_stats` are these
  measures. 746 decides the mechanics.
