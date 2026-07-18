---
status: done
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

- [x] Client verified (no client test tier — spec 503): `typecheck` clean for the ticket-014 files and
      import boundaries clean. `aggregateConditions` — the obvious first unit — was exercised through a
      Node type-strip harness on the ticket's scenario (a promo firing twice + a manual discount + a base
      row + a statistical carrier): 4 groups, promo `count:2` with both bbyNumbers and summed value/base,
      correct badges/categories (promotion/manual/pricing), and the statistical group numbered last with
      `hidden:1`. A Chromium drive against a mocked SIS.Api envelope (dev backend not available here, per
      013) exercised the real screen end-to-end — selecting a priced line shows the four detail tiles, the
      non-statistical cards render with the ×2 count pill + PROMOTION/MANUAL badges, expanding the promo
      card reveals the rate/base line + both sub-records, and the "Show/Hide statistical conditions
      (1 hidden)" toggle reveals/hides the MWST group (18/18 checks). Selecting a second line switches the
      detail and resets the toggle.
- [ ] Owner smoke (live sign-off, still pending — backend not available here): against dev SIS.Api with
      a basket whose priced line carries repeated + statistical conditions (BackOffice 509 test data),
      confirm the aggregated cards, expand sub-records, and statistical hidden-count against real engine
      output. Spec 503's owner-smoke seam (the dev-environment gap 419/476 note).

## Boundaries

oms-react repo. No BackOffice change, no bump, no flag. Aggregation stays **client-side** (BackOffice
486/488) — the endpoint returns raw conditions. Custom component, not ag-grid.

## Done when

Selecting a priced line shows its detail tiles + aggregated condition cards; expanding a multi-record
card shows its sub-records; the statistical toggle works — matching the 488 prototype.

## Blocked by

[013](013-web-sim-screen-tracer.md)
