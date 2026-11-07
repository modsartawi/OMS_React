---
status: done
spec: 811
blocked-by: 812
---

# 813 — Choosing a courier narrows the page to that courier's home deliveries

## What to build

A **Courier** picker joins the control bar beside Store and the leave-outs. It offers all couriers,
which is the default and the till's view, plus the four live couriers: FarEye (`FREY`), OTO (`OTOX`),
SMSA and Starlinks (`SLNK`). The retired `DAWA` is not offered.

- The choice is kept in the URL beside `store` and `leaveOutTypes`. All couriers is absent from the
  URL. An unknown value in a URL is sent as written, and the server's refusal is shown.
- It is sent to the door as `Courier`. With all couriers, no `Courier` is sent. It combines with the
  period, the store and the leave-outs.
- With a courier chosen:
  - a caption says the figures are that courier's home deliveries only;
  - the Pick-up funnel and the Pick-up row of the misses band are not drawn;
  - the store table's Pick-up view chip is hidden, and a URL naming `track=pickUp` reads as Delivery.
- With all couriers, the page is exactly as before.

The server does the scoping (counting by the dispatch it sent, never by the courier field's FarEye
default). The page only sends the code and hides what cannot belong to a courier.

## Spine reach

model/api (`Courier` on the query type) · logic (the query module: URL ↔ query ↔ door params; what a
courier hides) · component (picker, caption, hidden bands) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `courier round-trips through the URL and is sent as Courier` — absent = all couriers and no param; `FREY` → `courier=FREY` → `Courier: 'FREY'`; combines with store and leave-outs · pure
- [x] `a chosen courier hides what a pick-up owns` — lanes/misses rows/table views offered under a courier exclude Pick-up; `pickUp` track reads as Delivery; unchanged with all couriers · pure
- [x] drive — the picker lists four couriers, choosing FarEye sends `Courier=FREY`, the caption shows, the Pick-up funnel, misses row and table chip are gone; a reload keeps it; an `SDD-02132` stub is shown as the server's refusal; LTR and RTL · flow (Playwright)

## Boundaries

- Door: new `Courier` query param, **stubbed** (BackOffice brief not filed). `SDD-02132` covers an unknown code.
- i18n: picker label, all-couriers option, four courier captions, the courier caption. Codes are machine values.
- 812 reshapes the top of the page first; this slice adds to its control bar.

## Done when

The pure tests are green and the drive shows the courier scope end to end against the stub, in LTR and RTL.

## Blocked by

- [812](812-the-headline-strip-shows-the-six-server-figures-and-their-change.md)

## Comments

2026-11-06 — built on `impl/813-courier-scope`.

- **Model**: `StoreStatisticsQuery.Courier?` (`core/models/delivery-statistics.ts`).
- **Logic**: `query.ts` gains `courier` (URL `courier`, after `leaveOutTypes`; door `Courier`; `''` = all
  couriers, absent from both; an unknown code sent trimmed, as written) and `withCourier`. What a courier
  hides is its own pure module, `courier-scope.ts` (`COURIERS`, `hidesPickUp`, `courierTracks`,
  `courierTableTracks`, `courierTrack`); the page applies it over `readLanes` / `readMissesRows` and the
  table's views, so `lanes.ts` / `misses-rows.ts` / `store-rows.ts` are untouched. `track=pickUp` under a
  courier reads (and re-writes) as `delivery`; choosing a courier on the Pick-up view moves the table to
  Delivery. Pinned by `query.test.ts` (5 new) and `courier-scope.test.ts` (4).
- **Component**: Courier `Select` (core/ui) in `ScopeControls` between Store and Leave out; a code the
  picker does not offer (unknown, or the retired `DAWA` from an old link) is listed by its code so it can be
  undone. The caption sits under the period line, the courier name in a `<bdi>` slot. `StoreTable` takes an
  optional `views` prop. No hand-written controls added (ratchet unchanged).
- **i18n**: `courier.label/all/name.*/caption`, en + ar.
- **Drive**: stub answers `Courier=NOPE` with `SDD-02132`; new `driveCourier` (LTR + RTL). Whole drive
  326/326 green.
- Merged with 815: its `keepsPreviousAnswer` now compares `Courier` too, so a courier change never
  shows the previous scope's figures dimmed (pinned in `query.test.ts`).
- Not in this slice (ticket 816): the courier default view/sort of the table (Delivery, Out of slot % desc).
