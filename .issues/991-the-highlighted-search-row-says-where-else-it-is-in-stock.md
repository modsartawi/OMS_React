---
status: open
spec: 983
blocked-by: —
---

# 991: The highlighted search row says where else the item is in stock

Slice of [spec 983](983-the-console-is-built-around-the-caller-spec.md). Reference picture: the
*Call Center Console v3* artifact (v3).

## What to build

When the keyboard or mouse settles on a search row for 300 ms, the console asks `StockElsewhere`
for that item only and shows "N here · Malqa 2 · Yasmin 5" under the price (D12). The answers are
cached per item and plant. The `unknown` state says *could not check* and never *nobody has it*
(`stock-view.ts` rules).

## Spine reach

component (`ItemSearchPanel`) · pure (reuse `stock-view.ts`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `onlyTheSettledRowAsks`: arrowing through 10 rows quickly makes one request · pure/hook
- [ ] Drive: highlight, then the nearby stock appears; an outage shows *could not check* · flow

## Boundaries

No wire change. It never fans out over the result list.

## Done when

Live on the walk with a real out-of-stock item.
