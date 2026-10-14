---
status: done
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

- [x] `the Delivery row always shows all five misses` — including when each is 0 or absent (dash) · pure (vitest)
- [x] `the Pick-up row hides Returned back, Rejected and Rescheduled at zero or absent and shows them when not zero` — Close requested / Closed / cancelled always present · pure (vitest)
- [x] Drive: stub with a non-zero Pick-up Rejected shows it; stub with zeros hides the three; the old single misses band is gone; the no-`tracks` stub reads "—" · flow (drive) + typecheck

## Boundaries

- Same door, live: BackOffice 2659 (done; deploy unconfirmed → stubbed).
- Keys in `delivery-statistics` en + ar (row captions reuse "Delivery" / "Pick-up" from 489).

## Done when

Both vitest cases green, typecheck + lint pass, the drive shows the two rows with the Pick-up
hide-when-zero behaving on the stub.

## Blocked by

[489](489-the-statistics-page-draws-a-delivery-lane-and-a-pick-up-lane.md)

## Comments

**2026-10-14 — built AFK (done).**

- **Pure misses-row module:** `misses-rows.ts` — `readMissesRows(tracks, dash)` → the Delivery row (all five, always, from `tracks.delivery.misses`) and the Pick-up row (Close requested + Closed / cancelled always; Returned back, Rejected, Rescheduled only when a sent figure other than 0). Absent `tracks` or `misses` reads "—"; nothing derived, store-wide `misses` untouched (stays for 491's All view).
- **Page:** the "Did not go to plan" section now holds two rows, Delivery then Pick-up, captioned with 489's `lane.*` keys (no new locale keys), each a group named "Did not go to plan, <track>"; the till's accents kept. The single store-wide misses band is gone. Avg hand-over unchanged (own tile after the pair, no note); the model's `avgHandOverMinutes` doc comments now state the 2659 meaning.

**Proof.**
- vitest `misses-rows.test.ts` (4 cases incl. the two named) green; full suite 294 files / 5130 tests green.
- Drive `tools/delivery-statistics-drive.mjs` **226/226** against the stub, LTR + RTL: two rows in order with their captions; the Delivery row's five from `tracks.delivery.misses` (not the totals) with the till's accents; the Pick-up row at zero shows only Close requested / Closed / cancelled; a stub with a Pick-up Rejected of 2 shows it (danger accent, till order); rows in reading order under RTL; no store-wide miss tile anywhere; the no-`tracks` and the 2658 (tracks without misses) stubs read "—" on every shown miss with the three hidden; nothing beside Avg hand-over says "picked up".
- `npm run typecheck`, `npm run lint` (4 gates), `npm run build` green. /code-review + /standards-review run; no hard violations, findings triaged in `.afk/HITL-490.md`.

**Outstanding (not this ticket's):** the live door (492), web-vs-till parity, and an owner eyeball of the Arabic rendering (the RTL pass sets direction only; i18n stays `en`).
