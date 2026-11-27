---
status: open
spec: 983
blocked-by: 984, 4454 (BackOffice)
---

# 986: The receipt shows the original amount, the discount, VAT, the fee and the total

Slice of [spec 983](983-the-console-is-built-around-the-caller-spec.md). Reference picture: the
*Call Center Console v3* artifact (v3).

## What to build

The summary column shows the following rows:
- Original;
- Discount;
- Subtotal;
- VAT;
- Delivery fee (a waived fee is struck out and marked "free" with its reason);
- **Total**;
- a "Caller saves …" pill.

Every figure is read from `totals` (C1: `beforeDiscount`, `discount`, plus the existing fields)
(D6). The client never subtracts.

## Spine reach

contract doc (§ totals, v1.13) · model (`SessionTotals`) · pure (`receipt-view.ts`) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `theReceiptPrintsTheServersFigures`: a fixture with v1.13 totals renders each row verbatim; a v1.12 payload (no `beforeDiscount`) hides Original and Discount rather than inventing them · pure
- [x] `aWaivedFeeIsStruckWithItsReason`: a waived fee is struck out and shows its reason · pure
- [x] Drive on a v1.13 stub · flow

## Boundaries

Blocked on [BackOffice 4454](C:\Work\DMSCO\BackOffice\.issues\4454-callcenter-session-totals-carry-before-discount-and-discount.md) for live figures. Build against a stub of exactly C1.

## Done when

The receipt matches the engine on a live NOV10 order with delivery, and agrees with the delivery-details page's figures for the submitted order.

## Comments

**2026-11-27: built on a v1.13 stub (branch `t/986`); the live walk is owed.**

- **Built.**
  - The contract doc is in this repo, so §2 `totals`, the §2.1 field rule, the header and a §10
    **1.13** row now carry `beforeDiscount` and `discount` (C1). The row records the version
    crossing BackOffice 4454 found: the server's own 1.12 is the location link, and this doc's
    1.12 is 412's shortfall.
  - `SessionTotals` gains `beforeDiscount?` and `discount?`, both optional, because a v1.12 server
    omits them.
  - The pure module is `receipt-view.ts` (`receipt(totals, { delivering })`). It reuses
    `basket-view`'s `receiptView` and `fulfilment-view`'s `feeLine`, so the waived-reason degrade
    stays in one place. It has 12 vitest cases. The two proofs use figures that deliberately do
    not add up, so a receipt that summed would fail them.
  - The summary column shows Original · Discount (drawn with a minus sign) · Subtotal · VAT ·
    Delivery fee · **Total** · *Caller saves …*, above *Before you place it*. Every figure is
    wrapped in `Ltr`. A waived fee shows its own amount struck out, then *free*, then its reason.
  - The en keys are `receipt.original/discount/subtotal/free/saves`. `receipt.items` and
    `receipt.waived` are retired, and `delivery` now reads "Delivery fee". The ar keys are
    carried, although `lng` is still `en`. The *free over* threshold sentence now takes `fsi()`.
- **Drives.**
  - `tools/callcenter-receipt-drive.mjs` passes 22/22 on port 5206 (LTR 1366: v1.13, v1.12 and
    waived; RTL 1366).
  - `tools/callcenter-drive.mjs` and `tools/fulfilment-176-drive.mjs` still read the
    `[data-cc-blockers]` that 984 removed. Both now read the checklist's missing rows.
    `fulfilment-176-drive.mjs` passes 121/121 and `callcenter-rail-drive.mjs` passes 100/100.
- **Owed.**
  - Done-when, the live half: BackOffice 4454 is done but uncommitted, and its NOV10 `State` read
    is owed at this ticket's walk. On a live NOV10 order with delivery, the receipt has to agree
    with the engine and with the delivery-details page for the submitted order.
- **Decisions for the owner.**
  - (a) With `discount: 0` the receipt still prints Original and Discount 0.00, because the server
    sent them. Only the *Caller saves* pill hides.
  - (b) *Caller saves* shows the server's `discount`, which is **ex-VAT**. A waived delivery fee is
    not added in, because adding it would be a client sum. If the owner wants a VAT-inclusive
    saving, that is a new server field.
  - (c) A half-sent pair (one field without the other) draws neither row.
