---
type: wayfinder-ticket
wayfinder: grilling
map: 793
status: done
blocked-by: —
---

# 796 — Which new subject areas does v2 add, and which HQ questions do they answer?

## Question

v1 has four areas (745: till sales, orders by channel, delivery speed, callouts and donor
requests). Rank the candidates for v2 by the HQ questions they answer, the way 745 did:
- revenue, margin or cost (ruled out of v1);
- products and materials;
- loyalty, as aggregates only (no member-level data);
- coupons and promotions;
- insurance approvals and claims;
- SAP or IDoc flows.

Two gaps the owner's worked example (map 793 Notes) already needs, whatever else is ranked
(the facts come from [Which document sources and states define QC and a cancelled order?](804-which-document-sources-and-states-define-qc-and-a-cancelled-order.md)):
- **cancellation** in the orders area (a count plus a rate as Σ cancelled ÷ Σ orders, and which
  document states count as cancelled);
- **QC as a channel**: what QC is in `DocumentSource` terms, and whether it becomes its own
  channel group or a finer "order type" dimension below the five groups.

For each chosen area, name its measures, the dimensions it shares with the v1 areas, and the
questions that seed the evaluation set. Check every area against the no-PII rule; an area that
cannot be answered without a PII member is out. Keep the catalogue in
`docs/research/793-v2-semantic-model.md`.

> **From 804 (2026-11-06):** QC is not a `DocumentSource`. It is a **delivery type**
> (`DeliveryDocumentType = 'QC'`), wholly inside `own_app_web`, so the choice here is a delivery-type
> dimension (or QC flag) versus a sixth group. Cancellation facts and the recommended rate are in
> [804-qc-and-cancellation.md](../docs/research/804-qc-and-cancellation.md). This ticket must also
> rule on whether expiries (`AutoClose`) count as cancelled, and whether `N` is excluded.

## Answer

**Settled with the owner, 2026-11-06.** The full catalogue (measures, dimensions, the PII bar, and
questions Q16–Q31 with refusal cases) is
[793-v2-semantic-model.md](../docs/research/793-v2-semantic-model.md).

- **The baseline is the shipped model, not the 745 catalogue.** BackOffice's oms-analytics 1.2.0
  (BO 3387 + 3388) already ships item sales with the merchandising hierarchy, slow-moving stock
  and customers as hashed aggregates. **"Products and materials" is therefore done**, apart from an
  optional over-the-counter against prescription dimension.
- **v2 adds, ranked:**
  0. **orders: cancellation and delivery type.** This is required by the acceptance case.
  1. **coupons and promotions**: redemptions and discount value by campaign, bonus buy, store and
     channel.
  2. **the loyalty programme** as aggregates: points accrued, redeemed and expired, redemption
     value, enrolments, outstanding points and tier mix.
  3. **insurance claims, submitted amounts only**: claims, submission rate, submitted payer and
     patient share, rejection *counts*, and the order-line approval rate by payer.
- **Ruled out (owner):**
  - **margin, cost and profit.** There is no cost at the time of sale, only today's cost.
  - **SAP / IDoc health.** It is an operations concern, and the SAP export console covers it.
- **QC is a delivery type, not a channel** (804):
  - It is a new `delivery_type` dimension on orders and delivery, read from
    `DeliveryHeader.DeliveryDocumentType`.
  - An order with any QC delivery is QC. An order with no delivery is `(none)`.
  - Its labels come from the model, never from the replica's lookup, which has no QC row.
  - The acceptance case compares *channel = HungerStation* with *delivery type = QC*, two series
    that do not overlap.
- **Cancellation:**
  - A closed order is the order's own `C`, or a delivery at `C` or `X`. `N` is left out.
  - It is split by who requested the close:
    - **cancelled** is a person or the app, the store (`PH`), the courier (`Outbox`) or the
      platform (`BJ_SYSTEM`);
    - **expired** is `AutoClose`.
  - `cancellation_rate` = Σ cancelled ÷ Σ orders, and `expiry_rate` sits apart from it.
  - Both are order-dated (`EntryTime` cohort). They come with a `cancelled_by` dimension, a
    10-day re-read, and "may still rise" on days younger than 8.
- **Platform-side cancels are not on the replica. The owner chose to count cancellations inside
  OMS only, with a caveat.**
  - HungerStation and Deliverect cancellation figures are labelled "inside OMS only", and the AI
    repeats the caveat.
  - No DBA task is filed.
- **The PII bar** names every barred column the survey found (loyalty, claims, coupons, staff) and
  makes it a dbt test. Approved or paid insurance amounts, per-member points, diagnosis and coupon
  issuing are must-not-answer.
- **The channel map has a gap.** About 7.4 k call-centre orders a week (`COBE`, `COBC`, `CFLO`, …)
  fall into `other`. It is fixed in the same change.
