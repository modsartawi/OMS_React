---
status: open
spec: BackOffice 4165
blocked-by: 947, BO 4177
---

# 948 — The store profile page shows every section for a period and exports the workbook

Spec: BackOffice `E:\Projects\BackOffice\.issues\4165-retail-command-center-phase-1-the-overnight-store-scorecard-product-health-and-morning-brief-spec.md`.

## What to build

- Opened from the scorecard panel, a scorecard list or a link.
- **Period:** the rolling 4 weeks with last year beside them by default; year-to-date; or dates.
- **Sections** as the server sends them: headline and peers; mix by category, payer type and private label; by
  month, weekday and hour; basket shape; customers; discounts; sales by insurer and credit customer; the full
  product list; observations as sentences.
- Every money figure is labelled "incl. VAT". A section the server marks "not available yet" says so with its reason.
- The category mix links to the category profile, already filtered to this pharmacy.
- **Export** downloads the server's workbook for the same pharmacy and period.
- English and Arabic, as the home.

## Spine reach

route → page

## Proof (→ `tdd` red-green cycles)

- [ ] the page opens on the rolling 4 weeks and a period change asks the server again · vitest
- [ ] a not-available-yet section shows its reason · vitest
- [ ] the category mix links to the category profile filtered to the pharmacy · vitest
- [ ] Export asks for the same pharmacy and period · vitest

## Boundaries

Front end only.

## Done when

The tests are green, and on dev one pharmacy's profile opens from the map and exports.

## Blocked by

[947](947-the-kingdom-map-shades-the-regions-shows-each-pharmacy-as-a-point-and-opens-a-pharmacys-sco.md),
BackOffice 4177
(`E:\Projects\BackOffice\.issues\4177-a-store-profile-is-read-for-a-period-and-exported-as-a-workbook.md`)
