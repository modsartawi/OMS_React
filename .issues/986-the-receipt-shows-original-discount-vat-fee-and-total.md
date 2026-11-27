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

- [ ] `theReceiptPrintsTheServersFigures`: a fixture with v1.13 totals renders each row verbatim; a v1.12 payload (no `beforeDiscount`) hides Original and Discount rather than inventing them · pure
- [ ] `aWaivedFeeIsStruckWithItsReason`: a waived fee is struck out and shows its reason · pure
- [ ] Drive on a v1.13 stub · flow

## Boundaries

Blocked on [BackOffice 4454](C:\Work\DMSCO\BackOffice\.issues\4454-callcenter-session-totals-carry-before-discount-and-discount.md) for live figures. Build against a stub of exactly C1.

## Done when

The receipt matches the engine on a live NOV10 order with delivery, and agrees with the delivery-details page's figures for the submitted order.
