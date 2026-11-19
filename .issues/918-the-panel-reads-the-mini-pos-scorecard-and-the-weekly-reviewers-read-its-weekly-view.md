---
status: open
spec: BO 4063 (E:\Projects\BackOffice\.issues\4063-mini-pos-promoters-sell-non-pharmacy-items-spec.md)
blocked-by: BO 4075
---

# 918 — The panel reads the Mini POS scorecard, and the weekly reviewers read its weekly view

## What to build

An OMS report over the 4075 endpoint:
- **The money test:** trial and control pharmacies side by side, the uplift, and the payback ratio against the
  1.2× bar, using the promoter cost the panel enters.
- **The supporting measures.**
- **The weekly view:** compliance-stop lines, and pharmacies under 50% paid for two weeks running.

Behind a report grant.

## Spine reach

UI → BackOffice SIS.Api (4075)

## Proof (→ `tdd` red-green cycles)

- [ ] Component: the ratio coloured against 1.0× and 1.2×; the settling-in week shown as excluded · vitest
- [ ] Live walk against a SIS.Api with 4075

## Boundaries

—

## Done when

The report renders the 4075 data correctly and its component tests are green.

## Blocked by

BO [4075](E:\Projects\BackOffice\.issues\4075-the-scorecard-computes-uplift-payback-and-the-supporting-measures-for-trial-against-contro.md)
