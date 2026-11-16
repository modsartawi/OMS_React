---
status: open
spec: BO 3953 (C:\Work\DMSCO\BackOffice\.issues\3953-every-web-oms-document-shows-its-whole-family-spec.md)
blocked-by: 906, BO 3956
---

# 907 — Billings fold, a cut-short family warns, and a failed load stays quiet

## What to build

BackOffice spec [3953](C:\Work\DMSCO\BackOffice\.issues\3953-every-web-oms-document-shows-its-whole-family-spec.md) ("Family panel"), the rest of the prototype's rulings:

- **Billings** are grey, not a link, with the tooltip "Billings have no page" and the till invoice as a
  dashed label. Under one parent with **more than two** billings, only the first shows, followed by a
  "+ N more billings" button that expands them in place. The folding is part of the model.
- **A truncated family** shows a warning line under the tree: "Family cut short at 100 members — not
  every document is shown."
- **The root's partner reference** shows as a small label (source and order number).
- **A failed call** shows one quiet line in the section, and the rest of the page is unaffected.
- **Phone width and RTL:** the meta line is cut short before the chip, and the badge, number and chip
  never wrap away.

## Spine reach

tree model → UI.

## Proof (→ `tdd` red-green cycles)

- [ ] `family-tree` model: billings fold at more than two, with the N count; two billings both show;
  truncated is passed through · vitest
- [ ] i18n keys for the new strings in EN and AR · vitest
- [ ] By eye, against the prototype: RTL, phone width, dark mode, a truncated answer, and a failed call

## Boundaries

oms-react only. The partner label and the truncated flag need BackOffice 3956 deployed.

## Done when

The model tests are green and the by-eye checks match the prototype.

## Blocked by

[906](906-an-order-page-shows-its-family-and-every-delivery-opens-in-one-click.md), BackOffice
[3956](C:/Work/DMSCO/BackOffice/.issues/3956-a-family-past-the-cap-answers-truncated-and-a-bad-request-is-refused.md)
