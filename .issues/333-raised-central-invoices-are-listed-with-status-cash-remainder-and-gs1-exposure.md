---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2094-hq-invoices-a-delivered-delivery-no-till-invoiced-spec.md
blocked-by: 332, BackOffice 2100
---

# 333 — Raised central invoices are listed with their status, cash remainder and GS1 exposure

## What to build

This is the read screen for BackOffice spec 2094. Finance reconciles the cash remainders that no
Z-report counted, and regulatory reports by hand the GS1 packs that no RSD dispatch notice covered.

- **The list:** a *Central invoices* list beside 332's bulk screen, behind the same access, reading
  `GET Sd/CentralInvoice`.
  - **Filters:** date range, store and status.
  - **Columns:** delivery, store, requested by and at, reason, status (QUEUED / BILLED / STRANDED
    with its code), invoice number, total, cash remainder, picking document and outcome
    (CONSUMED / VOIDED / NONE), and *Serialised in a GS1 market*.
- **Serials:** a row flagged GS1 with a consumed picking document shows its serials in a row detail.
- **Export:** the grid exports to XLSX with the repo's existing grid export, so finance and
  regulatory can work from a file.

## Spine reach

UI (list, filters, detail, export) / HTTP client

## Proof

- [ ] *(still open — nothing has met a live SIS.Api)* Owner smoke test on dev: after 332's smoke test, the list shows the billed row with its invoice
  number and cash remainder, and a stranded row with its code. A seeded KSA serialised delivery is
  flagged with its serials, and the export opens in Excel.

## Boundaries

Client only and read only.

## Done when

The smoke test passes and the build is clean.

## Blocked by

[332](332-a-billing-officer-raises-central-invoices-from-a-delivery-or-a-pasted-list.md), BackOffice
[2100](C:\Work\DMSCO\BackOffice\.issues\2100-raised-central-invoices-can-be-listed-with-their-outcome-and-gs1-exposure.md)

## Notes (2026-09-29)

- **Built, client half.** The wire was checked against the shipped `CentralInvoiceWebEndpoints.List` and
  `CentralInvoiceListService`, and there is no drift. Params `from` / `to` (whole local days, inclusive), `dateBasis`
  (`requested` | `billed`), `store`, `status`. The answer is `data.rows[]`. Money is null while there is no invoice,
  and that is drawn blank, never 0.00. `billedAt` is `0001-01-01` until billed, which is drawn blank too.
- **Shape.** The list is a second page of the existing feature, `features/oms/central-invoice/CentralInvoicesPage.tsx` at
  `/oms/central-invoices`, with a "Central invoices" nav leaf in the OMS group.
  - It uses the **same** probe key as the raise leaf, so one 403 drops both leaves and the delivery page's action.
  - The route is `central-invoices` rather than `central-invoice/list`, because the raise leaf's prefix would claim that.
  - The feature now **has an `api.ts`**: the list call is its own. This partly answers 332's first sign-off question.
  - Pure modules: `list-criteria.ts` (landing range, the draft's problems, params) and `list-rows.ts` (status and
    outcome reading, the serial-detail rule, the serial sheet's lines).
- **Screen.**
  - **Filters** are a draft promoted by Search: date basis, from/to (landing on the last 30 days of requests), store and
    status. An unchanged Search asks again.
  - A reversed range, a malformed date, or a **billing-day range with status Queued/Stranded** is refused in place. The
    server reads the billed basis as BILLED rows only, so that pairing would come back empty and look like nothing
    was raised.
  - **Columns:** status is a pill with its refusal code in the next column. Pick outcome is blank until billed, never
    "None". Money is `formatMoneyOfUnknownCurrency`, because the row carries a country but no currency, and a BHD
    remainder keeps its third decimal. Every label is a `valueFormatter`, so the export carries words, not codes.
  - **Serials:** a per-row "N serials" button opens a dialog. It shows on any row with serials, and on a GS1 +
    CONSUMED row with none, where the dialog says so.
  - **"GS1 markets only"** is a client-side toggle (spec 2094 story 36), since the server has no GS1 filter. The export
    follows it.
- **Export.** Screen 1's writer moved up to `core/util/grid-xlsx.ts` (`gridSheet` / `textSheet` / `writeWorkbook` /
  `xlsxFileName`), and `deliveries/export.ts` is now a thin caller with an unchanged workbook.
  - Sheet 1 is the grid as shown: visible columns, filters and sort applied. Numbers stay numbers.
  - Sheet 2, "Serials", has one line per consumed pack of the rows shown. Each line carries its delivery, invoice,
    store, country and the row's **GS1 flag**, because the server returns the packs of every CONSUMED invoice,
    Bahraini ones too. Flagged, not dropped.
- **i18n.** `central-invoice:menu.list` and a `list.*` block. `CONTEXT.md` gains the invoice's status and pick outcome,
  **Cash remainder** and **Serialised in a GS1 market**.
- **Proof run.**
  - vitest: 2712 passed. New: `list.test.ts` (13), `core/util/grid-xlsx.test.ts` (4), and 2 in `layout/menu-model.test.ts`.
    `hasSerialDetail` and `pickOutcomeOf` were mutation-checked red, then restored.
  - typecheck, lint and build: clean.
  - `tools/central-invoice-list-drive.mjs`: **52/52**, stubbed. It covers:
    - the leaf lit alone, one Access call, and the landing params;
    - billed, stranded, queued, Bahraini and GS1-without-serials rows;
    - the serials dialog, the filters, and the three refusals in place;
    - the workbook read back: two sheets, labels, numeric cells, GTINs as text, and a column filter and the GS1 toggle
      narrowing both sheets;
    - a 400, a 403 (denied card, both leaves gone) and an ungranted session;
    - **Screen 1's export regression**: one "Delivery Documents" sheet.
  - Unchanged and green: `central-invoice-drive` (65/65) and `oms-access-drive` (28/28).
- **Still open: the owner smoke test on dev SIS.Api.** After 332's smoke test, open *Central invoices*:
  - the billed row shows its invoice number and cash remainder;
  - the stranded row shows its code;
  - a seeded KSA serialised delivery is flagged, with its serials;
  - the export opens in Excel.
- **Review (code-review + standards/spec).**
  - Fixed:
    - `textSheet`'s width spread every row into `Math.max`, which can overflow on a large unpaged export; it is now a loop;
    - the status list is spelled once;
    - `gridSheet` returns the rows it walked, so the export does not walk twice;
    - `notify` in place of raw `toast`, as 332;
    - no `·` glyph on screen;
    - the three spec findings: the GS1 column on the serial sheet, the billed-basis/status refusal, and the GS1 toggle.
  - **Declined:**
    - extracting the filter strip into its own component: one consumer;
    - a shared `wireEnum` reader over `verdictOf` / `statusOf` / `pickOutcomeOf`: three short readers, two layers;
    - hoisting the two leaves' identical `accessProbe` block: the shared key is test-pinned.
  - **Kept, for owner judgement:**
    - the serials button on a non-GS1 row that has serials: more than the ticket named, and never hides anything;
    - the 30-day landing window: a request still queued or stranded after 30 days drops out until a date end is cleared.
