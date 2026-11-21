---
status: open
spec: BackOffice 4110
blocked-by: —
---

# 934 — The price command center page opens on the price alerts, with accept and dismiss

## What to build

**Tracer bullet for the page** (BackOffice spec 4110, decision 8). A new Analytics page, the **price command
center**, shown only to a user holding the PriceWatch View grant (`GET PriceWatch/Access`). Its tab strip is
Index · Alerts · Grid · Matching · Feed health; tabs whose tickets are not built yet are hidden. This ticket ships
the shell and **Alerts**:

- **Mine** (`Alerts/Mine`, the default) and **All** (`Alerts`), with filters for A-level, B-level, brand,
  competitor and state. Ranked by value at risk.
- Each row shows our basic price and effective price, the competitor's regular and offer price, its seller, the
  gap, the value at risk, when it was observed, and the **recommended price**. While the alert's `FloorStatus` is
  `NOT_SET` (until BO 3507), the recommended price reads **"awaiting cost"** and no "can't match profitably" is
  ever shown.
- **Accept** and **Dismiss** (a reason is required; OTHER needs a note), with the Manage grant. The server's
  refusals are shown like any other refusal.
- Glossary wording (EN/AR): price alert, product match, competitor price. Never "notification" or "mapping".

Spec: `C:\Work\DMSCO\BackOffice\.issues\4110-price-command-center-release-1b-mindsite-as-a-second-source-the-page-and-the-product-grid-spec.md`.

## Spine reach

UI (page, route, nav entry, wire types, api)

## Proof (→ `tdd` red-green cycles)

- [ ] the page is hidden without the View grant · page test
- [ ] Mine is the default and is ranked by value at risk · component test
- [ ] an alert with `NOT_SET` shows "awaiting cost" and no profitability verdict · component test (pure)
- [ ] dismiss refuses to send without a reason, and OTHER without a note · component test (pure)
- [ ] accept / dismiss buttons are hidden without the Manage grant · component test

## Boundaries

Uses BackOffice endpoints that already exist (BO 3502/3503). No push of any kind.

## Done when

Proofs green, and the page walked on dev against `PriceWatch_Dev` alerts.

## Blocked by

None — can start immediately
