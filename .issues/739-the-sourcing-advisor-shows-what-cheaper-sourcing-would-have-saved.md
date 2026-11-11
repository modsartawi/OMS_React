---
status: done
spec: 734
blocked-by: 738
---

# 739 — The sourcing advisor shows what cheaper sourcing would have saved

## What to build

Spec 734 D15, D19 and D20. `/oms/sourcing-advisor` opens on the simulation for the last 30 days.

**Headline figures:**
- orders scored;
- orders with a cheaper on-time candidate, and their share;
- the total and average estimated saving in SAR.

**Range and filters.** The user can change the range (≤ 92 days) and filter by city, channel and
delivery type.

**Breakdowns** show the same figures by city, by channel and by delivery type.

**Top orders.** The top-savings list shows up to 50 orders, each linking to its explanation from
[738](738-the-sourcing-advisor-explains-why-an-order-went-to-its-store.md).

**Banners:**
- "Placeholder rates", while `placeholderRates` is true.
- "Scored through <date>" (`SOURCING-404` or `scoredThrough`), when the range runs past what the
  nightly job has scored.

All figures are passed through as sent. The screen never recomputes a saving.

## Spine reach

model/api (Summary call) · logic (period query, summary view model) · component (summary, breakdowns,
top list) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `sourcingSummaryQuery_capsAndValidatesTheRange`: a default of 30 days, more than 92 is refused
  before the call, and a reversed range is refused · pure
- [x] `sourcingSummaryModel_passesFiguresThroughAndFlagsPlaceholders`: an absent breakdown is read
  as empty, and the share is shown only when `orders > 0` · pure
- [x] `sourcing-advisor-drive: thirty-day-simulation`: covers all of:
  - the headline figures;
  - a filter re-queries;
  - a top-list row opens its explanation;
  - the placeholder and scored-through banners;
  - `SOURCING-402`;
  · flow

## Boundaries

New door `SourcingAdvisor/Summary` (BO-2, unbuilt), stubbed to the D20 wire. Grids spread
`OMS_GRID_BASE_COL_DEF` (lint).

## Done when

Both pure tests and the drive scenario are green.

## Blocked by

- [738](738-the-sourcing-advisor-explains-why-an-order-went-to-its-store.md)

## Open questions

- **S3 (owner):** whether a rate change re-scores history. It changes what "scored through" means
  after a rate change, but not this screen's shape.

## Resolution

Built 2026-11-03 on `spec/734-ask-the-oms` (commit 89e89479; review fixes in ed0e3911). All proofs pass against stubbed envelopes; the live walk is [740](740-ask-the-oms-and-the-sourcing-advisor-work-live-on-staging.md). Drives: copilot 177/177, sourcing advisor 100/100; 8,536 unit tests pass; lint shows only the 4 boundary violations already on main (insurance-rules aliases).
