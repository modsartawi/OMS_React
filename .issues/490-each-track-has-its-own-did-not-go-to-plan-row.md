---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2660-oms-react-statistics-by-track-brief.md
blocked-by: 489
---

# 490 — Each track has its own Did not go to plan row

## What to build

**Did not go to plan** becomes two rows, one per track, so a closed pick-up is never read as a failed
delivery.

- **Delivery row:** Returned back, Rejected, Rescheduled, Close requested, Closed / cancelled — all
  five, always (from `tracks.delivery.misses`).
- **Pick-up row:** Close requested and Closed / cancelled always. **Returned back, Rejected and
  Rescheduled are hidden when 0 and when absent**, and shown when not zero, so bad data stays visible
  (a pick-up is not driven).
- The old single store-wide misses band goes. The store-wide `misses` stays on the wire for the
  table's All view (491).
- A miss on an Unspecified delivery is in the store-wide `misses` only, in no row (owner's call on
  BackOffice 2659) — the rows are not expected to add up to it.
- No `tracks`, or `tracks` without `misses` (a 2658-only server): every figure on both rows reads "—"
  — the always-shown ones show the dash; the hide-when-zero ones are hidden.
- The miss accents stay as on the till (failures danger, re-plans attention).
- The store-wide Avg hand-over (moved by 489) now times a pick-up to Made ready (BackOffice 2659). Same
  field, no code change — but **nothing beside it may imply it averages Delivered + Picked up**. Check
  its caption, any note, and the Handed over note's placement.

## Spine reach

store/logic (pure misses-row module) · component · i18n (en + ar row captions) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `the Delivery row always shows all five misses` — including when each is 0 or absent (dash) · pure (vitest)
- [ ] `the Pick-up row hides Returned back, Rejected and Rescheduled at zero or absent and shows them when not zero` — Close requested / Closed / cancelled always present · pure (vitest)
- [ ] Drive: stub with a non-zero Pick-up Rejected shows it; stub with zeros hides the three; the old single misses band is gone; the no-`tracks` stub reads "—" · flow (drive) + typecheck

## Boundaries

- Same door, live: BackOffice 2659 (done; deploy unconfirmed → stubbed).
- Keys in `delivery-statistics` en + ar (row captions reuse "Delivery" / "Pick-up" from 489).

## Done when

Both vitest cases green, typecheck + lint pass, the drive shows the two rows with the Pick-up
hide-when-zero behaving on the stub.

## Blocked by

[489](489-the-statistics-page-draws-a-delivery-lane-and-a-pick-up-lane.md)
