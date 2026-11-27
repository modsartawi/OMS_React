---
status: open
spec: 983
blocked-by: 989, 4455 (BackOffice)
---

# 990: Last orders with Reorder all, and usual items as one-click chips

Slice of [spec 983](983-the-console-is-built-around-the-caller-spec.md). Reference picture: the
*Call Center Console v3* artifact (v3).

## What to build

In the caller column, *Last orders* shows the last 5 orders from C2: number, date, total, the items
in short, and **Reorder all**. *Usually buys* shows up to 8 chips. Both load once per attached
customer (D11).

*Reorder all* adds each item through the normal `addItem` path, one at a time:
- it stops at the first `BUSY`;
- a refused line shows its own message and the rest continue;
- the toast says "4 of 5 added".

## Spine reach

contract doc (§ CustomerHistory, v1.13) · model · api (`customerHistory`) · pure (`reorder.ts`) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `reorderAddsOneAtATimeAndReportsEachRefusal`: a stubbed refusal on item 2 of 3 still adds 1 and 3 and reports 2 · pure
- [ ] `noHistoryWithoutACustomer`: the read is not made before attach · pure
- [ ] Drive on a C2 stub · flow

## Boundaries

Blocked on [BackOffice 4455](C:\Work\DMSCO\BackOffice\.issues\4455-callcenter-customer-history-read.md) for live data. Build against a stub of exactly C2.

## Done when

On the walk, a known customer's last order is reordered and priced, and the chips add items.
