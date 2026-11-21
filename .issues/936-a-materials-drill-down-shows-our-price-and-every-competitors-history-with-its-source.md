---
status: open
spec: BackOffice 4127
blocked-by: 934, BO 4128
---

# 936 — A material's drill-down shows our price and every competitor's history, with its source

## What to build

The **material drill-down** (BackOffice spec 4127, decision 8), on the existing `Materials/{material}/Comparison`
endpoint, which carries each observation's source after BO 4128.

- Our basic and effective price over time, and each matched competitor's regular and offer price over time, on one
  chart, with the source of each observation labelled (`Scraper` / `Mindsite`). The authoritative source is drawn
  solid and the cross-check source faint.
- The matches (exact / comparable, how made, who and when), with **Break** (Manage grant).
- Comparable matches compared **per unit** (per g, ml, piece).
- It opens from an alert row (934) and from a grid row (935).

Spec: `C:\Work\DMSCO\BackOffice\.issues\4127-price-command-center-release-1b-mindsite-as-a-second-source-the-page-and-the-product-grid-spec.md`.

## Spine reach

UI (drill-down, chart, wire types)

## Proof (→ `tdd` red-green cycles)

- [ ] the authoritative series is solid and the other source faint, both labelled · component test
- [ ] a comparable match shows the per-unit price · component test (pure)
- [ ] break sends and refreshes, and is hidden without Manage · component test

## Boundaries

Needs BO 4128 (source on the comparison). Charts follow the repo's chart conventions.

## Done when

Proofs green, and the drill-down walked on dev.

## Blocked by

[934](934-the-price-command-center-page-opens-on-the-price-alerts-with-accept-and-dismiss.md), BackOffice [4128](C:\Work\DMSCO\BackOffice\.issues\4128-a-competitor-price-records-its-source-and-only-the-authoritative-source-raises-alerts.md)
