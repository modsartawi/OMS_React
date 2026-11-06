---
status: open
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

- [ ] `funnel stages carry their figure and their share of Came in` — proportions from the server's figures; an absent stage or absent Came in draws no bar and reads "—" · pure
- [ ] `the slot split is the server's counts and shares` — three segments as sent; absent shares/nothing delivered → no bar, "—"; a pick-up has no slot split · pure
- [ ] drive — both funnels drawn with bars, the slot split under Delivery, lane averages are Avg delivery time, side by side when wide and stacked when narrow, bars mirror under RTL · flow (Playwright)

## Boundaries

- No door change beyond 812's model.
- New `core/charts` forms must not import a feature; the contrast gate (`npm run lint`) covers their tokens.
- i18n: slot split captions, the lane average captions.

## Done when

The pure tests are green and the drive shows both funnels and the slot split in LTR and RTL against the stub.

## Blocked by

- [812](812-the-headline-strip-shows-the-six-server-figures-and-their-change.md)
