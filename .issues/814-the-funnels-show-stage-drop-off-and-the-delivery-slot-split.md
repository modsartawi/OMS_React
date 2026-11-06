---
status: done
spec: 811
blocked-by: 812
---

# 814 — The Delivery and Pick-up funnels show stage drop-off and the Delivery slot split

## What to build

The two lanes (489) become **funnels** that sit side by side from a wide breakpoint and stack below it.

- **Delivery**: Came in → Made ready → Out for delivery (Trips as its sub-caption) → Delivered, then
  a **slot split bar** of In slot | Out of slot | No slot.
- **Pick-up**: Came in → Made ready → Picked up.
- Each stage keeps its figure as text, isolated. Under it sits a bar whose length is the stage's
  proportion of that lane's Came in. That length is geometry only: no figure is shown that the
  server did not send, and an absent figure draws no bar.
- The slot split bar's segments are the server's counts, labelled with the server's shares. With
  nothing delivered, or no slot figures, it draws nothing and reads "—".
- Each lane's own average is now its **Avg delivery time** (`avgDeliveryMinutes`). Delivery is timed
  from due; Pick-up is timed from entry to Made ready.
- Under a chosen courier (813) the Pick-up funnel is not drawn; this slice must keep that working,
  whichever lands first.

The stage bar and the share bar are built as small `core/charts` forms with plain props. They sit in
the `dir="ltr"` box, mirror through props, and use ink and slot tokens. They are never drawn inside
the feature.

## Spine reach

logic (the lanes module gains bar proportions and the slot split, read as sent) · component (two
small `core/charts` forms + the funnel layout) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `funnel stages carry their figure and their share of Came in` — proportions from the server's figures; an absent stage or absent Came in draws no bar and reads "—" · pure
- [x] `the slot split is the server's counts and shares` — three segments as sent; absent shares/nothing delivered → no bar, "—"; a pick-up has no slot split · pure
- [x] drive — both funnels drawn with bars, the slot split under Delivery, lane averages are Avg delivery time, side by side when wide and stacked when narrow, bars mirror under RTL · flow (Playwright)

## Boundaries

- No door change beyond 812's model.
- New `core/charts` forms must not import a feature; the contrast gate (`npm run lint`) covers their tokens.
- i18n: slot split captions, the lane average captions.

## Done when

The pure tests are green and the drive shows both funnels and the slot split in LTR and RTL against the stub.

## Blocked by

- [812](812-the-headline-strip-shows-the-six-server-figures-and-their-change.md)

## Comments

2026-11-06 — built on `impl/814-funnels`.

- **Logic** (`lanes.ts`): each stage carries `bar` — its figure over the lane's own Came in, geometry
  only, `null` (no bar) for an absent stage, an absent Came in or a Came in of 0; a stage past Came in
  (first-event counting) draws a full bar, its figure as sent. The Delivery lane carries `slot`
  (`SlotSplit`: three segments with the server's count and share; No slot has no share), `drawn` only
  when all three counts and both shares came and a count is above 0. The Pick-up lane has no `slot`.
  Lane averages now read `avgDeliveryMinutes` (an older server's hand-over average reads "—").
  `figures.ts` gains `readShare` (percent, one place). Pinned by `lanes.test.ts` (+6 tests).
- **`core/charts`**: `StageBar` (fraction → bar, `null` draws nothing) and `ShareBar` (weights →
  segments, `role="img"` with the caller's label). Both in the `dir="ltr"` box, mirrored through an
  `rtl` prop (default `chartMirror.rtl`); colours are slot / ink tokens (`--chart-1`, `--chart-3`,
  `--ink-3`, track `--divider`) — all already in the contrast gate, no new token.
- **Component**: `Funnels.tsx` draws exactly the lanes it is given (one lane → full width), so 813
  hides Pick-up under a courier by passing the Delivery lane alone. Funnels are vertical (stages top
  to bottom, figure + bar), side by side from `lg`, stacked below; the chevrons are gone. `Tile`
  moved to its own file (page + funnels share it).
- **i18n** (en + ar): `slot.*`, `lane.avg.*` now "Avg delivery time" for both lanes with
  `lane.avgNote.*` saying what each is timed from.
- **Drive**: stub Pick-up `avgDeliveryMinutes` 30.75 (≠ its hand-over 31.5); new check group 18
  (bars and their shares, RTL growth side, slot split segments + key + label, averages, side by side
  at 1600 / stacked at 1000, older and 2658 servers). LTR + RTL.
- `npm run lint`: contrast, controls, grid base, palette green; boundary gate fails only on the
  pre-existing `insurance-rules` cross-feature imports.
- ⚠ Open: segment colours (teal In slot, blue Out of slot, ink-grey No slot) are a choice, not a ruling.
