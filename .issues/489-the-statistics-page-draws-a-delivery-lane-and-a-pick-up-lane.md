---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2660-oms-react-statistics-by-track-brief.md
blocked-by: —
---

# 489 — The statistics page draws a Delivery lane and a Pick-up lane

Slice 0 of the by-track split (BackOffice spec 2657, brief 2660). Amends 484's page.

> **Prerequisite (not a blocker ticket):** the uncommitted 488 work in `main`'s tree — the
> "Handed over, by delivery type" Delivered | Picked up group and the "Delivered + picked up" note —
> must be committed before this starts. The brief assumes that state ("the Handed over hero, its
> Delivered | Picked up pair").

## What to build

An ops manager reads the period's flow in **two lanes**, Delivery and Pick-up, as on the till, so
Out for delivery is never read beside a Handed over that includes every pick-up.

- **The wire model** (`core/models/delivery-statistics.ts`) gains, on the totals AND on every
  `stores[]` row, the optional:

  ```ts
  tracks?: {
    delivery: {
      flow: { cameIn?, madeReady?, outForDelivery?, trips?, handedOver? }   // handedOver = Delivered
      misses?: { returnedBack?, rejected?, rescheduled?, closeRequested?, closedOrCancelled? }
      avgHandOverMinutes?: number | null                                   // entry -> Delivered
    }
    pickUp: {
      flow: { cameIn?, madeReady?, handedOver? }                            // handedOver = Picked up; NO outForDelivery key
      misses?: { ...the same five }
      avgHandOverMinutes?: number | null                                   // entry -> Made ready
    }
  }
  unspecified?: number
  ```

  Every new field optional: absent means "—", never 0. Do not model `outForDelivery` on Pick-up.
- **The page layout** replaces the single flow band with:
  - **A store-wide group:** Came in, Handed over (with its "Delivered + picked up" note and the
    Delivered | Picked up pair), the store-wide **Avg hand-over** (moved here from the misses band;
    caption unchanged) and the **Unspecified** tile.
  - **Delivery lane:** Came in → Made ready → Out for delivery (sub-caption **N trips**, from
    `tracks.delivery.flow.trips`) → **Delivered**, then **Avg time to deliver** drawn after the
    stages, not as another stage.
  - **Pick-up lane:** Came in → Made ready → **Picked up**, then **Avg time to ready**.
  - The store-wide Made ready and Out for delivery tiles go (decision A, owner-agreed 2026-10-14):
    they stay on the wire for the table's All view. A stray out-for-delivery on a pick-up is in the
    store-wide figure only, by decision, so the lanes do not add up to it.
- **Unspecified tile:** shown only when `unspecified` is a number above 0; hidden at 0 and when absent.
- **The client never derives a figure:** never add lanes into a total, a total minus a lane, sum the
  store rows, average the averages, or compute Unspecified as Came in minus the lanes.
- An average with nothing to average (`null`) or absent reads "—", with no unit beside it.
- The Came in / Handed over chart, periods, store picker, leave-outs, `asOf` are untouched.

## Spine reach

model/api · store/logic (pure lane module) · component/route · i18n (en + ar) · test

## Proof (→ `tdd` red-green cycles)

- [x] `lanes read each track's stages from tracks` — Delivery has four stages ending at Delivered with trips on Out for delivery, Pick-up has three ending at Picked up and no Out stage; each lane carries its own average · pure (vitest)
- [x] `no tracks reads every lane figure as the dash, never 0` — absent `tracks`, absent `trips`, `null` average each read "—" · pure (vitest)
- [x] `the Unspecified tile shows only for a number above zero` — 3 → shown, 0 → hidden, absent → hidden · pure (vitest)
- [x] Drive: `tools/delivery-statistics-drive.mjs` stub emits `tracks` + `unspecified`; asserts the two lanes, their stage order, trips on Delivery, no Out tile on Pick-up, the lane averages, the Unspecified tile; and a second stub with no `tracks` reads "—" across both lanes · flow (Playwright drive) + typecheck

## Boundaries

- No new endpoint — same `GET SdDocumentWeb/StoreStatistics`, additive fields (live: BackOffice 2658,
  done; deploy unconfirmed → drive stubbed).
- No new namespace: keys in `delivery-statistics` (en + ar). Arabic DRAFT per BackOffice map 1199:
  Delivery توصيل · Pick-up استلام · Avg time to deliver متوسط مدة التوصيل · Avg time to ready
  متوسط مدة التجهيز · Unspecified غير محدد.
- Bidi: every figure isolated whole (`Ltr`); the trips caption keeps its `<Trans>` slot.
- Logical Tailwind only.

## Done when

The three vitest cases are green, `npm run typecheck` + `npm run lint` pass, and the drive shows both
lanes (and the all-dash variant) against the stub.

## Blocked by

None — can start immediately (after the 488 working-tree commit noted above).

## Comments

**2026-10-14 — built AFK (done).**

- **Model/api:** `core/models/delivery-statistics.ts` gains the optional `tracks` (`DeliveryStatisticsTracks`: `delivery` with `DeliveryTrackFlow`, `pickUp` with `PickUpTrackFlow` — no `outForDelivery` key) and `unspecified`, on the totals and on `DeliveryStatisticsStore`. `api.ts` passes both through as sent (a `null` reads as absent).
- **Pure lane module:** `lanes.ts` — `readLanes(tracks, dash)` (Delivery: Came in → Made ready → Out for delivery with trips → Delivered; Pick-up: Came in → Made ready → Picked up; each with its own average and a unit only beside a number) and `showsUnspecified`. Nothing derived.
- **Page:** a store-wide group (Came in, Handed over + note, Delivered | Picked up pair, Avg hand-over moved here, Unspecified tile only when > 0), then the Delivery and Pick-up lanes (`LaneBand`: chevrons between stages, `rtl:rotate-180`; the average set apart after them with no chevron), then the misses band (5 tiles; 490 splits it), chart and table untouched. Store-wide Made ready / Out for delivery tiles gone (decision A).
- **i18n:** `band.storeWide`, `lane.delivery|pickUp`, `lane.avg.delivery|pickUp`, `unspecified.caption|note` in en + ar (the brief's Arabic verbatim); `band.flow` removed.

**Proof.**
- vitest `lanes.test.ts` (6 cases incl. the three named) green; full suite 293 files / 5127 tests green.
- Drive `tools/delivery-statistics-drive.mjs` **204/204** against the stub (LTR + RTL): store-wide group order, band order, both lanes' stages + captions, reading order and mirrored chevrons, lane averages after the stages, trips on Delivery from `tracks.delivery.flow.trips`, no Out stage on Pick-up, Unspecified 3 shown / 0 hidden / absent hidden, a 2658 answer (tracks without misses), and the no-`tracks` fixture reading "—" across both lanes; one row per lane at 1000 px.
- `npm run typecheck`, `npm run lint` (4 gates), `npm run build` green.

**Outstanding (not this ticket's):** the live door (492), web-vs-till parity, and an owner eyeball of the Arabic rendering (the drive's RTL pass sets direction only; i18n stays `en`). `tools/delivery-statistics-live-drive.mjs` still targets the old `flow` band and must be re-pointed by 492. Decisions logged in `.afk/HITL-489.md` (store-wide heading "All deliveries", the Unspecified note, "Trips N" wording, optional per-track `flow`).
