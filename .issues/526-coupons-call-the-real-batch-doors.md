---
status: open
spec: BO 2737 (brief § HQ contract: campaign coupons (2755))
blocked-by: 522
---

# 526 — Coupons call the real batch doors

Split out of [520](520-the-rule-campaign-screens-call-the-real-doors-on-staging.md) on 2026-10-17.

## What to build

Re-point 515/516 (all POST, `Rules/Authoring/CouponBatches/*`):

- **Create `{ templateId, kind: random|universal|personal|import, count?, code?, members?, csv?, validFrom?,
  validTo?, eachCodeOnce, oncePerCustomer }`**. Import is the same door with `kind: import` and `csv`
  (`code[,customerId]`). **There is no pre-import check door**: drop `checkCouponImport` and show the
  refusal instead (`RULES_BATCH_BAD` names the bad member ids, `RULES_BATCH_CODE_TAKEN`). The reply carries
  `budgets`, the coupon / profile budgets the builder **adds to the campaign** and saves as the draft (ADR
  0094). Wire that.
- **`List { campaign }`** answers batches (`codes`, `used`, `disabled` counts) and **not codes**. 515's
  per-code grid has no door. The codes come from `Export { batchId }` (`csv`). Either the page lists batches
  and a batch opens its exported codes, or ask BO for a codes door. Grill this.
- **`Export { batchId }`** answers `{ fileName, csv }`: save the server's CSV as is, and drop the client CSV
  writer for this export.
- **`DeleteUnused { batchId }`** answers `{ deleted, kept }`.
- `templateId` is a SIS.Coupons template. Find out where the screen gets it (the campaign's coupon effect?)
  while building.

## Spine reach

api · logic (coupon-form, coupon-csv) · component (CouponsPage, dialogs) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `couponForm_buildsCreateBody` for all four kinds · pure
- [ ] coupons drive re-stubbed, green · flow

## Done when

The coupons page calls only the four real doors, and its drive is green stubbed.
