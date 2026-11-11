---
type: wayfinder-ticket
wayfinder: task
map: 793
status: open
blocked-by: —
---

# 818 — The DBA adds the Coupons V2 and payment-discount tables to the replica publication

## Question

v2's coupons-and-promotions area can count till-side coupon and bonus-buy discounts today. It cannot
count **redemptions net of reversals**, the **coupon campaign**, the **redemption type** or
**payment discounts**: on 2026-11-06 none of these tables were on the replica `172.23.27.47` /
`POS`, under any name or in any publication
([793-v2-sources-on-the-replica.md](../docs/research/793-v2-sources-on-the-replica.md) §3).
They live in the central POS database on the publisher: SIS.Api's `DefaultConnection`,
`172.23.27.50` / `POS`. The owner is the DBA. This ticket is done when the tables are on the
subscriber with recent rows.

It does **not** block the spec. The spec states the area in two steps: till-side figures first, and
redemption and campaign measures once this lands. It does block those measures in the build.

**HITL checklist (owner as DBA):**

Confirm first:
- [ ] `172.23.27.50` is `DWPOS03`, the publisher of the 19 `POS` publications.
- [ ] Which publication takes them. A new one keeps the snapshot small; otherwise use `Other1`.

Must add (BackOffice schemas: `Sartawi.Retail.Data/Modules/Coupons/V2/Sql/001…010`; the payment
discount maps are under `Modules/Pos/Data/Maps`):
- [ ] `CouponTransaction`: PK `TransactionId`. It is the redemption grain (`IsSuccessful`,
  `RefTransactionId`, `RedemptionType`, `StoreCode`, `RedemptionTime`).
- [ ] `CouponInstance`: PK `CouponCode`. It holds `TemplateId`.
- [ ] `CouponTemplate`: PK `TemplateId`. It holds `CampaignId` and `Description`.
- [ ] `PaymentDiscountCampaign`: PK `CampaignCode`.
- [ ] `PaymentDiscountSwipe`: PK `SwipeId`. It holds `TrxNumber`, `StoreCode` and `CampaignCode`.

Optional and small:
- [ ] `PaymentDiscountCampaignBin`.

**Column-filter these out (personal data):**
- `PaymentDiscountSwipe.Bin` and `PaymentDiscountSwipe.Last`, which are card digits;
- `CouponInstance.CustomerId`, the coupon holder (filter it, or at the least it is never declared);
- `PaymentDiscountSwipe.CashierCode`, your call. Staff ids are elsewhere on the replica already.

**Not needed:**
- `NphiesTrxClaimHeader`/`Line`: claims come from `NAuth`, already replicated.
- `SdDocumentInsurance`: `SdDocumentHeader.PayerCode` is enough.
- `CouponImportJob*`, `CouponReversalQueue` and `CouponAdminAudit` are admin and queue tables.

**Ready to run:** [818-add-replica-articles.sql](assets/818-add-replica-articles.sql), the same
steps 0–4 as 753's draft (check `immediate_sync`, add the articles, filter the columns, refresh and
snapshot, then count).
