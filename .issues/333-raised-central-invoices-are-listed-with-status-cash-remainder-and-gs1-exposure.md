---
status: open
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

- [ ] Owner smoke test on dev: after 332's smoke test, the list shows the billed row with its invoice
  number and cash remainder, and a stranded row with its code. A seeded KSA serialised delivery is
  flagged with its serials, and the export opens in Excel.

## Boundaries

Client only and read only.

## Done when

The smoke test passes and the build is clean.

## Blocked by

[332](332-a-billing-officer-raises-central-invoices-from-a-delivery-or-a-pasted-list.md), BackOffice
[2100](C:\Work\DMSCO\BackOffice\.issues\2100-raised-central-invoices-can-be-listed-with-their-outcome-and-gs1-exposure.md)
