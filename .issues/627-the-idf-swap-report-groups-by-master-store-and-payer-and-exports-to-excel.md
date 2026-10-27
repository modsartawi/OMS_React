---
status: done
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

- [x] `swap report and export take the same query as the event filter` · pure — `idf/report.test.ts` 5/5
- [x] drive `tools/idf-events-drive.mjs` (extend) — 86/86 STUBBED (LTR + RTL; 38 new) — report tab rows; export requests the same filters and saves a file · flow

## Boundaries

New endpoints `swap-report`, `swap-report/export` — stubbed. Keys in `insurance-idf`. Ungated until 628. Money is a
machine value; no `fsi` in the grid or the export.

## Done when

The stubbed report renders grouped rows and the export downloads with the same filters, proofs green.

## Blocked by

[626](626-idf-events-a-paged-log-filtered-by-store-payer-master-outcome-and-dates.md)

## Comments

**2026-10-27 — built (impl/3157-627).** `idf/report.ts` (row type, `swapRowKey`, `swapReportFileName`),
`idf/SwapReport.tsx` (the tab: grouped table + Export), `idfReportApi` / `swapReportQuery` under 627's slot in `api.ts`
(`report` via `api.get`, `export` via `api.blob` + core `saveBlob`, both sending `filterDoorParams`), a `tab` on
`IdfEventsQuery` (`?tab=report`, `events` by default), the tab bar in 626's slot of `EventsPage.tsx`, the `report`
object in `insurance-idf.json` (EN + AR), `idfReportStub` in `tools/idf-stubs.mjs`. Proof: `report.test.ts` 5/5 (both
doors called with the same literal filter, never outcome / page), drive 86/86 STUBBED; typecheck, test, lint green.

Decisions (overrulable; 3169 finalises the wire):
- **Row shape ASSUMED:** `{ masterId, storeCode, payerCode, counts: { <outcome>: n }, priceDifference, averageTimeSeconds }`;
  a missing count shows 0, a null price difference shows blank (no pick taken), average time as `m:ss` like the log.
  Money is `formatMoney` (2 dp, sign kept) in `Ltr`; no `fsi` anywhere.
- **One column per filterable outcome** (the six live ones, the log's words); reserved outcomes are not columns.
- **The outcome filter is hidden on the report tab** (the report does not take it); it stays in the address, so
  going back to the log restores it. Switching tab resets the page to 1.
- **Export** is enabled only when the report has rows; the file keeps the server's `Content-Disposition` name, else
  `idf-swap-report-<from>-<to>.xlsx`. A failure toasts through `notify.apiError`.
- **Not paged:** the report is read whole (grouped rows are few); 3169 may add paging.
