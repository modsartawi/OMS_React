---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2544-material-master-on-the-web-spec.md
blocked-by: 452, 453, 454 (live: BackOffice 2545–2549 deployed to staging + Gs1SerialInquiry seed run)
---

# 455 — The Materials screens call the real doors on staging

## What to build

Switch the four Materials screens from stubs to the live `MaterialWeb/*` doors on the staging
SIS.Api, then the owner walks them through.

- Remove or retire the stubs, keeping only those the vitest helpers use.
- **Fix any drift from the contract in the contract first**
  (`C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md`), then in both
  repos — never only in the client.
- Run each drive against staging where a staging login is available.

## Spine reach

UI → live BackOffice doors → HQ DB / Stock Visibility

## Proof (→ `tdd` red-green cycles)

- [ ] Each of `materials-search`, `materials-detail`, `materials-stock` and `materials-gs1`
  drives green against staging
- [ ] **Owner walk**, against real data:
  - search by a real barcode, a real GS1 scan, an AR word and an A→C level path;
  - open a serialised material's Batches and Stock tabs;
  - stock-check 5 materials × one city;
  - GS1-check a known sold unit and see its history;
  - read the Arabic labels.
- [ ] A user without `Gs1SerialInquiry` does not see GS1 check; a user without
  `MaterialStockInquiry` sees no Stock tab and no Stock check.

## Boundaries

Needs BackOffice 2545–2549 deployed to staging, the `Gs1SerialInquiry` seed run on the staging
OMS-HQ DB, and `StockV2:*` set in staging's appsettings. **Human in the loop (HITL)**: the walk is
the owner's, so an AFK runner should stop here and hand it back.

## Done when

The drives are green on staging and the owner has signed off the walk.

## Blocked by

[452](452-an-hq-user-opens-a-material-s-detail-tabs.md),
[453](453-a-supply-user-checks-stock-for-a-basket-of-materials-across-stores.md),
[454](454-a-quality-user-scans-gs1-units-and-reads-their-history.md)
