---
type: wayfinder-ticket
wayfinder: research
map: 793
status: done
blocked-by: 796
---

# 800 — Which tables do the new areas need, and are they on the replica?

## Question

For each area the subject-area decision chose, find the source tables and check them against the
production read replica (`172.23.27.47` / `POS`, `DWPOSREPL03`):
- whether each table is replicated (v1 found `Callout*` and `LoyCustomerFirstPurchase*` missing);
- its row count, its indexes (columnstore or not) and the cost of a daily aggregate;
- the keys that join it to the v1 marts' shared dimensions;
- any table that needs the DBA to add it to the publication, filed as a task like 753.

**From 796 (2026-11-06):** the areas and their candidate tables are in
[793-v2-semantic-model.md](../docs/research/793-v2-semantic-model.md) §1 and §3. Check these first:
- **Coupons:** `CouponTransaction`, `CouponInstance`, `CouponTemplate`, `RetailTrxCondition`,
  `RetailTrxBonusbuy`, `BbyHeader` and `PaymentDiscountCampaign`. `RetailTrxDetailPromo` is known
  present.
- **Loyalty:** `LoyActivity`, `LoyMembership`, `LoyTier`, `LoyMember` (only `CreatedAt`,
  `CreatedByBranchId` and `MemberType` are read) and `LoyCampaign`. Find out which of the `Loy`,
  `Loy_2` and `Loy_Family` publications carries each.
- **Claims:** `NphiesTrxClaimHeader` and `NphiesTrxClaimLine`, and whether `Outcome` /
  `AdjudicationOutcome` are filled. v1 found no outcome. The `Nphies` and `Others` publications
  arrive from `NPDB01`.
- **Order lines:** `SdDocumentLine.ApprovalStatus`, which letters mean "approval asked", and
  `SdDocumentInsurance.PayerCode`.
- **Keys:**
  - a claim to its till transaction (so it can carry the sales channel);
  - the loyalty-redemption payment on `RetailTrxPayment` (for the reconcile).

If claims are missing, file a task like 753, or the claims area shrinks to the order-line measures.

Read-only, through the sanctioned `sqlcmd` shape; needs the corporate network. Notes go in
`docs/research/793-v2-sources-on-the-replica.md`.

## Answer

Resolved 2026-11-06 on the live replica: read-only, aggregates only. Notes:
[793-v2-sources-on-the-replica.md](../docs/research/793-v2-sources-on-the-replica.md). Probes and
outputs are `docs/research/800-replica-probe-{a,b,c}.*`.

- **Orders (rank 0): ready.** `DeliveryHeader` is in the `OMS` publication.
  - The till → order key 799 owed is **`RetailTrx.OrderNo = SdDocumentHeader.OrderNo`** (99.7 %),
    **not** `DocumentNo` (36 of 12,457).
  - The path to delivery type is `RetailTrx.OrderNo → SdDocumentHeader.OrderNo → DocumentNo →
    DeliveryHeader.RefDocumentNo`, at 8 s a day.
- **Coupons and promotions (rank 1): half ready.**
  - **What is there:**
    - `RetailTrxCondition` (1.8 B, NCCI). Its `Year`/`Month` are always 0, so it is dated through
      `RetailTrx`: 7.7 s a day.
    - `RetailTrxDetailPromo` (PK seek, 7 s a day).
    - `Bonusbuy` (`Master1`), which is the bonus-buy dimension: 214 of 214 codes match. `BBHeader`
      matches only 198.
    - `SdDocumentLine.PromotionCoupon*` for coupons on orders.
  - **Wrong names in the catalogue:** `BbyHeader` and `RetailTrxBonusbuy` do not exist.
  - **Missing, and not in any publication:** all of Coupons V2 (`CouponTransaction`,
    `CouponInstance`, `CouponTemplate`) and `PaymentDiscountCampaign`/`Swipe`. They sit in the
    publisher's central POS database (SIS.Api `DefaultConnection`, `172.23.27.50` / `POS`).
  - **What that means:**
    - Till-side coupon value, bonus-buy value and promoted share can be built now.
    - Redemptions net of reversals, the coupon campaign, `RedemptionType` and payment discounts
      wait on [The DBA adds the Coupons V2 and payment-discount tables to the replica publication](818-the-dba-adds-the-coupons-v2-and-payment-discount-tables-to-the-replica-publication.md).
- **Loyalty (rank 2): ready.**
  - **Publications:** everything is in `Loy`; `Loy_2` and `Loy_Family` carry the rest.
  - **`LoyCampaign` does not exist.** The campaign is `LoyActivity.CampaignId`, with no
    description.
  - **Cost:** `LoyActivity` (342 M) has only a PK on `ActivityId` and no date index, so one day by
    date is a **56 s full scan**. `ActivityId` is ascending, so the incremental reads an id range
    with a 10-day re-read.
  - **Expiry** is about 184 k rows a day on one system branch, so it is programme-level, not
    per store. 90 % of the other activities join `Store`.
  - **Reconcile key:** the till's `PayTypeID = 'Points'` payment, with
    `RequestId = LoyActivity.RequestId`. It matches 2,135 of 2,137 branch redemptions.
  - **E-commerce redemptions** (`RDEM`) carry `PointsAmountInCurrency = 0`, so their value needs a
    rule.
- **Insurance claims (rank 3): ready, on another table.**
  - **Not needed:** `NphiesTrxClaimHeader`/`Line` are absent from the replica, but they are the old
    WPF path.
  - **The table is `NAuth`/`NAuthLine`.** The Nphies service records claims there
    (`ClaimType` 1 Claim, 4 DirectClaim) beside prior authorisations. Both are replicated by
    `Nphies` from `NPDB01`, fresh to the hour. That is 150 k claims in 30 days.
  - **Keys:**
    - Store: `ProviderCode = Store.StoreCode` (951 of 951).
    - Till: `(ProviderCode, InvoiceNo) = (StoreCode, TrxNumber)`, 98 %, which gives a claim its
      sales channel.
  - **Dating:** claims are batched about three weeks after the service, and the submitted value is
    on the lines (header amounts are 0). The outcome arrives later as a row update.
  - **No DBA task** is needed, and the area does not shrink.
  - **Prior authorisations carry approved and rejected amounts as columns.** This corrects 796's
    "approved amounts exist only in FHIR" and is the owner's call (map fog).
- **Order-line approval:** `SdDocumentLine.ApprovalStatus` holds only blank or `A` in production,
  so `order_line_approval_rate` is dropped.
- **Personal data is replicated** in `LoyMember` (mobile, name, national id, …) and `NAuth`
  (patient name, id, birth date, diagnosis). Staging models select by column list only, with a
  schema test.
- **Trap:** `NPaymentNotice` and `NPaymentReconciliation` are on the replica but stale since
  2026-02 and in no publication. They are never read.
- **Cost:** every daily read is 5–25 s, except the loyalty date scan. No pre-aggregation is needed
  (§6 of the notes).
