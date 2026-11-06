---
status: done
spec: 811
blocked-by: —
---

# 812 — The headline strip shows the six server figures and their change against the compared window

## What to build

Slice 0 of spec 811. The store-wide group on Delivery statistics (Came in, Handed over with its
Delivered | Picked up pair, Avg hand-over) becomes a **headline strip** of six `core/charts` KPI
tiles, wide across the page:

- **Came in**
- **Handed over**, with the Delivered | Picked up split as its sub-line (the till's split, kept)
- **In slot**: the server's share of Delivered, with "n of N delivered" under it
- **Out of slot**: likewise
- **Delivered per trip**
- **Avg delivery time** (minutes)

Each tile shows its **change against the previous period** exactly as the server sends it. The tile
picks the arrow from the sign of the server's `change` and the words from its `changePct`, in ink and
never in a status colour. A tile with no previous figure shows no change line. The strip names the
**compared window** the server sends: "vs {{range}}" for a closed period, "vs {{day}} to {{time}}" for
Today. The Unspecified tile stays, still shown only above zero. The old entry-based Avg hand-over tile
leaves the web.

The wire model gains **every** optional field the spec proposes (⚠ web proposal for the BackOffice
brief, not yet filed), so later slices only read them:

- `previous` (the compared window plus six `{ value, change, changePct }`);
- `avgDeliveryMinutes` on the store-wide figures and on both tracks;
- the Delivery track's `slot` (`inSlot`, `outOfSlot`, `noSlot`, `inSlotShare`, `outOfSlotShare`) and
  `deliveredPerTrip`;
- the same additions on each store row.

The feature's `api.ts` passes them through as sent. The page derives **nothing**: no share, ratio or
change is computed. A figure the server leaves out reads "—", never 0. The share "0 of 0" is the
server's absent share and reads "—".

If `KpiTile` needs its change passed in as a ready value rather than computed, adjust `core/charts`
so it accepts the server's change. Never compute the change in the feature.

## Spine reach

model/api (core model additions, api passthrough) · logic (a pure headline model) · component (the
strip on `KpiTile`) · i18n (`delivery-statistics` keys) · test (vitest + drive stub)

## Proof (→ `tdd` red-green cycles)

- [x] `headline model reads the six figures and their change as sent` — given a full wire answer, the six tiles carry the server's values, change, changePct and direction from the sign; nothing is computed · pure
- [x] `headline model reads dash, never 0, for an older server` — an answer with no `previous`, no `slot`, no `deliveredPerTrip`, no `avgDeliveryMinutes` gives "—" tiles with no change line; a real 0 reads 0 · pure
- [x] drive (`tools/delivery-statistics-drive.mjs`, stub extended with the new fields + an older-server fixture) — six tiles in order with the stub's figures; the compared-window sentence for Today and for a Range; "—" with the older fixture; every value isolated; LTR and RTL; no page errors · flow (Playwright)

## Boundaries

- Door: `GET SdDocumentWeb/StoreStatistics`, new optional response fields, **stubbed**. The BackOffice brief is not filed (spec 811 Further Notes). No new error codes.
- i18n: new keys in `delivery-statistics` only (six captions, the sub-lines, the compared-window sentences); range built with `formatRange` and isolated whole.
- `core/charts` stays feature-free; any analytics helper reused graduates to `core`.

## Done when

The two pure tests are green and the extended drive passes in LTR and RTL against the stub.

## Blocked by

None — can start immediately.

## Comments

2026-11-06 — built on `impl/812-headline-strip`.

- **Model** (`core/models/delivery-statistics.ts`): every optional spec-811 field — `previous`
  (`StatisticsPrevious` + six `PreviousFigure`), `avgDeliveryMinutes` on the totals, the store rows and
  both tracks, the Delivery track's `slot` (`SlotKeeping`) and `deliveredPerTrip`. `api.ts` passes
  `avgDeliveryMinutes` and `previous` through as sent (`tracks`/`stores` already were).
- **Logic**: `headline.ts` (`readHeadline`, `comparedWindow`), pinned by `headline.test.ts` (7 tests).
  Direction is read from the sign of the server's `change`; no `change` = no change line even with a
  `changePct`. "n of N delivered" takes N from `tracks.delivery.flow.handedOver` (the Delivery track's
  Delivered), not the store-wide `flow.delivered`.
- **Component**: `HeadlineStrip.tsx` on `core/charts` `KpiTile` unchanged (it already takes a ready
  `delta`), each wrapped with its caption and sub-line; Unspecified stays in the strip's grid above
  zero. The Avg hand-over tile and the `split.*` / `avgHandOver.caption` keys are gone.
- **Assumed** (⚠ BackOffice spec 3404 is a draft and does not pin these): `changePct` is a 0–1 fraction like the shares (KpiTile
  writes it as a percent); `until` is `HH:mm` (a full local time is also read as its HH:mm);
  `previous.*.value` is the previous period's figure (shown as "versus X in the previous period").
- **Drive**: stub extended (all new fields; Today `previous` with `until`, a Range one without);
  the older-server and 2658 fixtures drop every new field. LTR + RTL green.
- `npm run lint`: the four non-boundary gates are green; the boundary gate fails on a pre-existing
  `insurance-rules/aliases/door-shapes.test.ts` cross-feature import, untouched here.
