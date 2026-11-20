---
status: open
spec: BackOffice 4096
blocked-by: BO 4097, BO 4098
---

# 932 — An author picks KSA or Bahrain on a promotion and sees it in the list

## What to build

- **The promotion page** gets a sales-area select with two entries (EN/AR): "KSA retail — 1000 / 20 — SAR"
  and "Bahrain retail — 1000 / 21 — BHD". KSA is preselected on a new promotion. Once the promotion holds a
  bonus buy, the select is disabled (from the document's locked flag, BO 4098) with a one-line explanation.
  The server's refusal is shown like any other refusal.
- **The promotion list** (Bonus Buy Maintenance overview) gets a sales-area column.
- The wire types `BbyPromotion` / `BbyPromotionSave` carry `salesOrganization`, `distributionChannel` and the
  currency and labels. Save sends the pair.

Spec: `C:\Work\DMSCO\BackOffice\.issues\4096-an-oms-promotion-is-written-for-ksa-or-bahrain-spec.md`.

## Spine reach

UI (promotion page, overview, wire models, api)

## Proof (→ `tdd` red-green cycles)

- [ ] a new promotion defaults to KSA, and save sends 1000 / 20 · promotion page test / `overview.test.ts`
- [ ] picking Bahrain sends 1000 / 21 · component test
- [ ] the select is disabled with its explanation when the document says locked · component test
- [ ] the overview row shows the sales area · `overview.test.ts`

## Boundaries

Needs the BO 4097 contract (the pair on the promotion) and BO 4098 (locked flag + refusal).

## Done when

The Proof tests are green, and a stubbed drive shows creating a Bahrain promotion, the list column and the
locked select. A live walk is owed after BO 4097/4098 deploy.

## Blocked by

BackOffice 4097, 4098
