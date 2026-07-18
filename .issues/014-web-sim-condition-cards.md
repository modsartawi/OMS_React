---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\503-web-pos-simulation-spec.md
blocked-by: 013
---

# 014 — Pricing detail with expandable condition cards + statistical toggle

> Moved from BackOffice `.issues/511`. Renumbered into oms-react's tracker.

## What to build

Selecting a result line reveals its pricing detail — the ⭐ risky UI, prototyped in BackOffice ticket 488
(`C:\Work\DMSCO\BackOffice\.issues\488-web-sim-full-parity-ui-mapping.md`; prototype
`scratchpad/pos-sim-web-proto.html`).

- **Per-item detail** — a title and four summary tiles: base price, total discounts
  (`salesDiscount + promotionDiscount`), tax, net total.
- **Applied pricing rules as condition cards** — the client aggregates the line's **raw** `conditions`
  rows (a faithful port of the WPF controller's grouping):
  ```
  aggregateConditions(conditions):
    group by (conditionType, conditionRate, conditionRateUnit, conditionOrigin)
    per group: count, sum(base), sum(value), subs[], distinct bbyNumbers
    badge(origin):    P|B → PROMOTION,  M → MANUAL,  H → HEADER,  else none
    category(origin): P|B → Promotion,  M → Manual Discount,  H → Header Discount,  else Pricing
    index: number the non-statistical groups first, then the statistical ones
    a group expands to its subs only when count > 1
  ```
  Each card: index + category + type + description, a record-count pill when `count>1`, the origin
  **badge**, the aggregate value; expand → rate/base + the individual sub-records.
- **Statistical toggle** — "Show/Hide statistical conditions (N hidden)" reveals/hides the
  `isStatistics` groups and reports the hidden count.
- **Per-line pricing messages** surfaced under the detail.

## Spine reach

app/UI (React) — pure client logic over the `POST Pricing/Simulate` result.

## Proof (→ `tdd` red-green cycles)

- [ ] Owner smoke (no client test tier): with a basket whose line has repeated + statistical conditions
      (from BackOffice 509's test data, e.g. a promo firing twice + a statistical carrier), the detail
      shows aggregated cards with correct counts/badges, expand reveals sub-records, and the toggle
      reveals/hides the statistical group with the right hidden-count. `aggregateConditions` is the
      obvious first unit if a client test tier is later stood up.

## Boundaries

oms-react repo. No BackOffice change, no bump, no flag. Aggregation stays **client-side** (BackOffice
486/488) — the endpoint returns raw conditions. Custom component, not ag-grid.

## Done when

Selecting a priced line shows its detail tiles + aggregated condition cards; expanding a multi-record
card shows its sub-records; the statistical toggle works — matching the 488 prototype.

## Blocked by

[013](013-web-sim-screen-tracer.md)
