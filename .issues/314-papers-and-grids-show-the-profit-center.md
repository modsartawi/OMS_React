---
status: done
spec: 308
blocked-by: —
---

# 314 — The ACR form, voucher and grids show the profit center beside the store code

## What to build

Render the profit center as the server formats it (`PH-019 (P019)`, or the store code alone) on the ACR form
rows, the voucher's store line, and a profit center column in the Collections, ACRs and Attempts grids (CSV
included).

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [x] criteria / columns / projection modules under vitest for the behaviour above:
  - `collections-columns.test.ts` / `attempts-columns.test.ts`:
    - Profit Center (Store) (`storeText`) is a default column, right after the store code;
    - it has a `t()` header and no `valueFormatter` or `valueGetter`, so it renders as sent;
    - the raw `profitCenter` is in the tail;
    - the completeness union covers both new fields.
  - `csv.test.ts`: both fields are written as `identity`. `="PH-1042 (1042)"` / `="PH-1042"`; the code alone keeps
    its leading zero (`="0104"`); an unrecorded profit center is an empty cell; the headers are the screen's labels.
  - `store-text.test.ts` (new): the papers print `storeText` as sent, never composed. A field missing on a pre-1990
    server prints `storeCode`.
  - Mutations run, each red: `storeText` as `text` in the csv (1 test), the paper printing `storeCode` (2), the column
    folded into the tail plus a `PH-` formatter on Attempts (4). Vitest **2455** green.
- [x] the screen renders against the contract stub (loading, empty, error, refusal):
  - `tools/profit-center-drive.mjs` passes **77/77**. It stubs 1990's samples verbatim (the Collections row, the
    ACR-form row, the receipt page) beside the app's own fixtures, and checks:
    - on Collections and Attempts: the column is default and sits after the store code; `PH-019 (P019)` and `P020`
      render as sent; the floating filter matches either half; the raw value is in the tail;
    - the CSV writes both fields wrapped;
    - loading / empty / 500 / 400 `ServedByKindUnknown` / bare 403 on both lists;
    - the ACR drill-down (`?acr=`, `AcrId`) shows the column;
    - ACR form: رقم الصيدلية prints `storeText` on every row as an LTR isolate, in reading order, wrapped inside its
      52px cell. A full page of 22 wrapped rows ends inside A4; the PDFs stay 3 and 2 sheets; the code alone prints
      on an unrecorded store; the contract row, print media, a pre-1990 row (code), loading, the `AcrNotFound` miss
      and a 500 failure all behave;
    - voucher: the Store. line prints `storeText` on one line, clear of the title block, on one A4 / one PDF page. It
      holds on every multi-shift page, on the settlement page, on BHD (code alone), for the contract page, for a
      pre-1990 page (code), on loading, the miss and a 500.
  - Mutations run: dropping the LTR isolate turns the direction check red; printing `storeCode` on the voucher turns
    it red.
  - Regression: `collection-print-drive` **151/151**, now with a profit center on every fixture row, so the A4 break is
    proven against the post-DDL worst case. `collection-drive` **220/220**: CSV header count 27, Attempts 11. Also
    `four-filters` 80/80, `collections-filters` 44/44, `acr-closed-by` 41/41, `ready` 44/44. Typecheck, lint (3 gates)
    and build are clean.
- Outstanding (not AFK's):
  - any drive against a LIVE SIS.Api with 1990. Until the owner's Plants DDL (BackOffice 1997), that door answers
    `profitCenter: ""`;
  - a human eye on the printed ACR form and voucher with the wider store text.
  Every check above is stubbed.

## Blocked by

- BackOffice [1990](C:\Work\DMSCO\BackOffice-spec1976\.issues\1990-hq-papers-and-web-grids-show-the-profit-center.md) must be **done** and its `## Web contract` written

## Comments

**Done 2026-09-25 (AFK).** Built against BackOffice 1990's `## Web contract` and cross-checked with the committed
`CollectionInquiryModel` / `CollectionAttemptInquiryModel` (`ProfitCenter` + get-only `StoreText`),
`AcrFormDocumentRow.StoreText`, `CollectionReceiptDocument.StoreText` and `ProfitCenterFormat`. No drift. The only
fields added are `profitCenter` + `storeText` (the grid rows) and `storeText` (the paper row and page).

- **"ACRs grid" reads as the ACR's per-row data.** The contract keeps the `CollectionWeb/Acrs` row unchanged ("an ACR
  spans a round and carries no store"). The column shows on its drill-down, the Collections door under `?acr=`, and
  on the ACR form's rows.
- **Grids:** Profit Center (Store) sits beside the store code rather than replacing it. The raw Profit Center is in
  the tail and the CSV. Labels are Ready's (317). Sort and filter follow the shown text (313's rule).
- **Papers:** the server's string as sent. A field missing (a SIS.Api without 1990) prints the code, as before.
- **Glossary:** Profit center.

Decisions, and what the review changed, are in `.afk/HITL-314.md`.
