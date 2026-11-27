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

- [x] `onlyTheSettledRowAsks`: arrowing through 10 rows quickly makes one request · pure/hook
- [x] Drive: highlight, then the nearby stock appears; an outage shows *could not check* · flow

## Boundaries

No wire change. It never fans out over the result list.

## Done when

Live on the walk with a real out-of-stock item.

## Comments

**2026-11-27 — built on `t/991`, stubbed; live walk owed.**

- Pure module `src/features/callcenter/console/nearby-stock.ts`: `createSettle` (trailing 300 ms
  debounce over what is aimed at), `nearbyStockQuery` (the query options the component's `useQuery`
  and the test's `QueryClient` share; key `['callcenter','nearbyStock', tx, plant, item]`, fresh 60 s,
  never retried) and `nearbyLine` over `stock-view.ts`'s states (3 stores named by area name, else city,
  else code; the rest counted from the server's `withStock`).
- `ItemSearchPanel`: the keyboard's highlighted row or the mouse's hovered row is *aimed*; only a row
  still aimed 300 ms later mounts `NearbyStock`, so one item asks. The line sits under the meta line
  (price); an outage says *Could not check other stores — not the same as nobody having it*. The list
  re-scrolls the row in when the line grows it. en + ar keys under `search.nearby`.
- Proof 1: `nearby-stock.test.ts` (12 cases, vitest node env, fake timers + a real `QueryClient`):
  ten rows at 60 ms make one request, for the tenth; revisiting asks nothing; another plant asks again.
- Proof 2: `tools/callcenter-nearby-drive.mjs` — 23/23 on vite :5202, LTR and RTL, StockElsewhere
  stubbed to §3.5's shape (no capture exists, BackOffice 876).
- **Owed (Done when):** the live walk with a real out-of-stock item. Not checked: how long the real
  hop takes against the 300 ms settle, and whether staging's `areaName` is populated (falls back to city).
