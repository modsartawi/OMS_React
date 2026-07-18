---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\503-web-pos-simulation-spec.md
blocked-by: 013
---

# 015 — Bonus-buy tabs + pricing elements

> Moved from BackOffice `.issues/512`. Renumbered into oms-react's tracker.

## What to build

The lower-right tabbed panel of the screen, completing result-parity with the WPF.

- **Applied Bonus Buys** tab — a read-only grid of the promotions that fired (bby no. / promo no. /
  offer / description / discount type / total discount / remaining usage).
- **Potential Bonus Buys** tab — a grid of promotions that *could* apply (bby / promo / description /
  status / valid-to / min value / skip reason); selecting a row drives a second **Prerequisites** grid
  below it (prereq / material grouping / material / required vs found qty / min vs found value / met?).
  This is **two stacked ag-grid Community grids** driven by row selection — NOT ag-grid Enterprise
  master-detail (mirrors the WPF).
- **Pricing Elements** tab — the raw pricing-procedure trace grid (step / counter / type / description /
  base / rate / unit / value / statistical / subtotal / bonus-buy flags), shown when the request set
  `includePricingElements`.

## Spine reach

app/UI (React) — renders the `POST Pricing/Simulate` result's `appliedBonusBuys` / `potentialBonusBuys`
/ `pricingElements`.

## Proof (→ `tdd` red-green cycles)

- [x] Owner smoke: a basket that triggers an applied promo + a potential (unmet) promo shows both tabs
      populated; selecting the potential bonus buy shows its prerequisites with the met/unmet state; with
      "Pricing Elements" checked, the elements tab lists the procedure steps.
      Verified by driving the real app (Chromium) with the three Pricing endpoints stubbed by a fixture
      (applied BBY100 + potential unmet BBY200 with a met + an unmet prereq + pricing-element trace):
      all three tabs render, the potential→prerequisites selection drives the stacked grid, and the
      Pricing Elements tab lists the procedure steps — 7/7 checks, zero console errors. The test runner
      isn't installed yet (per CLAUDE.md), so this is the `tdd` typecheck + drive-the-app fallback;
      `npm run typecheck` and `npm run build` are green.

## Boundaries

oms-react repo. No BackOffice change, no bump, no flag. ag-grid **Community** only (two-grid pattern, no
master-detail).

## Done when

The three tabs render their data; the potential→prerequisites selection works — matching the WPF's
bonus-buy panels.

## Blocked by

[013](013-web-sim-screen-tracer.md)
