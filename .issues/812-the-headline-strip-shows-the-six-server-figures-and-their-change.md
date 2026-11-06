---
status: open
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

- [ ] `headline model reads the six figures and their change as sent` — given a full wire answer, the six tiles carry the server's values, change, changePct and direction from the sign; nothing is computed · pure
- [ ] `headline model reads dash, never 0, for an older server` — an answer with no `previous`, no `slot`, no `deliveredPerTrip`, no `avgDeliveryMinutes` gives "—" tiles with no change line; a real 0 reads 0 · pure
- [ ] drive (`tools/delivery-statistics-drive.mjs`, stub extended with the new fields + an older-server fixture) — six tiles in order with the stub's figures; the compared-window sentence for Today and for a Range; "—" with the older fixture; every value isolated; LTR and RTL; no page errors · flow (Playwright)

## Boundaries

- Door: `GET SdDocumentWeb/StoreStatistics`, new optional response fields, **stubbed**. The BackOffice brief is not filed (spec 811 Further Notes). No new error codes.
- i18n: new keys in `delivery-statistics` only (six captions, the sub-lines, the compared-window sentences); range built with `formatRange` and isolated whole.
- `core/charts` stays feature-free; any analytics helper reused graduates to `core`.

## Done when

The two pure tests are green and the extended drive passes in LTR and RTL against the stub.

## Blocked by

None — can start immediately.
