---
status: open
spec: BackOffice 4157
blocked-by: 941, BO 4162
---

# 944 — A scanned GS1 code fills the item and the vendor batch, and each batch says whether its expiry matches

Spec: BackOffice `C:\Work\DMSCO\BackOffice\.issues\4157-the-stock-console-every-stores-stock-held-and-reserved-searched-down-to-the-batch-spec.md`.

## What to build

The third box of the search-first frame, so every list tab and Find get it at once.

- **The GS1 box** takes a scanned or pasted code. Enter (a scanner's trailing Enter included) or Search calls
  `StockConsole/Scan`, then searches with the item and the vendor batch it answered.
- **What was read** is shown above the rows as chips: item and name, GTIN, lot, expiry, serial.
- When the GS1 box is filled it wins: the item and batch boxes are filled from it and shown.
- **Unknown GTIN**: a line says the item was not found, and the search runs on the lot alone as a vendor batch.
- **A plain barcode**: the item is filled, no batch.
- **Not a code we know**: a line says so, and nothing is searched.
- **Expiry mark** on batch rows after a scan: "matches the scan" or "scan says ..." with the scan's expiry. When the
  code's day is not known (day 00), the comparison is by month.
- The code stays in the address with the other boxes, so a shared link repeats the scan.

## Spine reach

UI (the frame's third box, the chips, the expiry mark, wire types, api, locale files)

## Proof (→ `tdd` red-green cycles)

- [ ] a scan answer fills the item and batch boxes and builds the chips · vitest (pure module)
- [ ] an unknown GTIN searches the lot alone and says the item was not found · vitest
- [ ] a plain barcode fills the item only; an unknown code searches nothing · vitest
- [ ] the expiry mark: same day, different day, and by month when the day is not known · vitest
- [ ] the locale key-mirror test passes · vitest

## Boundaries

As ticket 940. A GS1 code is left-to-right data inside an Arabic page: the bidi rule applies to the box and the chips.

## Done when

Proofs green, and on dev the prototype's example code finds its item and vendor batch in a store's Batches tab.

## Blocked by

[941](941-a-stores-page-reads-its-header-fresh-and-searches-its-items-and-batches-only-when-asked.md),
BackOffice [4162](C:\Work\DMSCO\BackOffice\.issues\4162-a-gs1-code-gives-the-stock-console-its-item-and-its-vendor-batch.md)
