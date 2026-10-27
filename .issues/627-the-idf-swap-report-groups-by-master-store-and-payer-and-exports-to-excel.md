---
status: open
spec: BackOffice 3157 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)
blocked-by: 626
---

# 627 — The IDF swap report groups by master × store × payer with counts per outcome, the price difference and the average time, and exports to Excel

## What to build

A **Swap report** tab beside the event log (626), sharing its filters (from / to, store, payer, master) (door 3169,
[brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)). `GET IdfPriority/swap-report` returns
rows grouped master × store × payer: a count per outcome, the summed price difference on picks taken (money), and
the average time spent. **Export** downloads the server's `…/swap-report/export` `.xlsx` for the same filters,
through `core/api` (not a client-built file).

## Spine reach

model/api (download) · logic (shared filter) · component · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [ ] `swap report and export take the same query as the event filter` · pure
- [ ] drive `tools/idf-events-drive.mjs` (extend) — report tab rows; export requests the same filters and saves a file · flow

## Boundaries

New endpoints `swap-report`, `swap-report/export` — stubbed. Keys in `insurance-idf`. Ungated until 628. Money is a
machine value; no `fsi` in the grid or the export.

## Done when

The stubbed report renders grouped rows and the export downloads with the same filters, proofs green.

## Blocked by

[626](626-idf-events-a-paged-log-filtered-by-store-payer-master-outcome-and-dates.md)
