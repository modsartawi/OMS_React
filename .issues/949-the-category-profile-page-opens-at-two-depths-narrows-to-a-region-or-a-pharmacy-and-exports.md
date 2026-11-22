---
status: open
spec: BackOffice 4165
blocked-by: 946, BO 4178
---

# 949 — The category profile page opens at two depths, narrows to a region or a pharmacy, and exports

Spec: BackOffice `E:\Projects\BackOffice\.issues\4165-retail-command-center-phase-1-the-overnight-store-scorecard-product-health-and-morning-brief-spec.md`.

## What to build

- Opened from a category name in the brief, from a store profile's category mix, or from a top-level profile's
  list of second-level categories.
- **Filter:** the chain, a region or one pharmacy.
- **Sections** as the server sends them: sales, units, growth and share beside the other categories; product
  health counts and stock value; promotion share and discount; the pharmacies and regions that over-sell and
  under-sell it.
- Margin, availability, the price index and private label show "not available yet" with the reason.
- **Export** downloads the server's workbook.
- English and Arabic, as the home.

## Spine reach

route → page

## Proof (→ `tdd` red-green cycles)

- [ ] a second-level category opens the same page one level down · vitest
- [ ] the filter narrows every section together · vitest
- [ ] the four missing sections show "not available yet" with their reason · vitest
- [ ] a pharmacy in the over- and under-selling list opens its store profile · vitest

## Boundaries

Front end only.

## Done when

The tests are green, and on dev each top-level category opens and narrows to one pharmacy.

## Blocked by

[946](946-the-command-center-home-shows-the-morning-brief-the-status-line-and-the-language-switch.md),
BackOffice 4178
(`E:\Projects\BackOffice\.issues\4178-a-category-profile-is-read-at-two-depths-narrowed-to-a-region-or-a-pharmacy-and-exported.md`)
