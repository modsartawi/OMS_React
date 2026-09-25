---
status: done
spec: 308
blocked-by: —
---

# 312 — The collection voucher's red box carries the accountant's description

## What to build

`CollectionVoucher` renders the description inside `.cv-overage-box` on the surplus day page and the
settlement page, beside the amount and entry number, wrapping up to 200 characters. A page without a
description prints the entry number alone. Ordinary days keep the empty box.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [x] criteria / columns / projection modules under vitest for the behaviour above:
  `voucher-box.test.ts` (`voucherBox`, 10 cases). It pins that:
  - an ordinary day draws the caption and no occupant;
  - both described page kinds carry the description under the entry, and the settlement page has no amount;
  - a surplus or settlement page without a description prints the entry number alone;
  - both fixtures are exactly 200 characters and pass through uncut;
  - the text is verbatim, with no trim and no collapse of inner spaces;
  - a server without 1984, which omits the field, still draws no third line.

  Vitest **2300** green.
- [x] the screen renders against the contract stub (loading, empty, error, refusal):
  `tools/collection-print-drive.mjs` §6c passes **151/151**, against 1984's page shape served over the stubbed
  `CollectionWeb/Receipt/{id}`. It includes the contract's own sample page, value for value. It checks that:
  - on both page kinds, a 200-character description renders once, verbatim, under the entry number;
  - it wraps to several lines, held to the WPF's 340px;
  - it stays inside the red box on every edge, with nothing clipped;
  - the box stays in the sheet's right half;
  - the names block still lands on the A4 sheet;
  - it is red and not bold;
  - a 200-character run with no space wraps too;
  - an English-only line resolves LTR and still aligns right;
  - pages without a description print the entry number alone;
  - an ordinary receipt's box height is unchanged;
  - under `@media print` the three long cases stay inside the box and on the sheet, and the PDF is exactly **1**
    sheet for each;
  - loading is a sentence and never a blank sheet (the request is held);
  - the contract's 400 `CollectionReceiptNotFound` is the miss;
  - a bare 403 is a failure and never the miss.

  Regression: `collection-drive` **220/220**. Typecheck, lint (3 gates) and build are clean. Mutations were run:
  - dropping `max-width` turns 6 checks red;
  - dropping `overflow-wrap` turns 2 red;
  - passing `''` through `voucherBox` turns 5 red.
- Outstanding (not AFK's): a human eye on the printed A4 voucher's red box with a 200-character description, and any
  drive against a LIVE SIS.Api with 1984. Every check above is stubbed.

## Blocked by

- BackOffice [1984](C:\Work\DMSCO\BackOffice-spec1976\.issues\1984-the-shortage-settlement-receipt-and-web-voucher-carry-the-description.md) must be **done** and its `## Web contract` written

## Comments

**Done 2026-09-25 (AFK).** Built against BackOffice 1984's `## Web contract`, and cross-checked with the committed
`CollectionReceiptDocumentService` and `CollectionVoucherModel.DeductionDescriptionText`. No drift, and no field
beyond `deductionDescriptionText`.

- **Model:** `VoucherPage.deductionDescriptionText: string`.
- **Collapse:** `inquiry/voucher-box.ts` is the red box's pure projection. An empty occupant becomes `null`, and the
  voucher then draws no line for it. `CollectionVoucher` renders the description as the box's third line
  (`.cv-overage-desc`), under the entry number.
- **Wrapping:** the line wraps at the WPF's `MaxWidth=340`, with `overflow-wrap: anywhere`. It is red and not bold.
- **Direction:** the line has `dir="auto"` with a physical `text-align: right` (the facsimile's exemption). This is
  a logged departure from WPF parity, so an English-only line keeps its trailing punctuation.
- **Placement:** the ticket says "beside", but the build follows the contract's "under `deductionEntryText`", which
  is also where the WPF puts it.
- **Fixtures:** `surplus-described` and `settlement-described` (200 characters each). The description-less
  `surplus` and `settlement` stay as the legacy cases.
- **Drive:** its fixture-count guard had been stale since the settlement fixture was added (it expected 6, and there
  were 7). It is fixed at 9.

Decisions are in `.afk/HITL-312.md`. The one needing the owner is the text direction.
