---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3389-orders-and-erx-are-searchable-in-oms-react-and-an-insurance-order-shows-everything-it-received-and-how-it-was-priced-spec.md
blocked-by: 787
---

# 789 — A delivery of an insurance order shows its money strip and links to its order's insurance

## What to build

Backend: BackOffice spec 3389 (`C:\Work\DMSCO\BackOffice\.issues\3389-orders-and-erx-are-searchable-in-oms-react-and-an-insurance-order-shows-everything-it-received-and-how-it-was-priced-spec.md`). SIS.Api minimal APIs, System.Text.Json web defaults (camelCase).

On a delivery's Details page, for a delivery whose order is an insurance order: a compact strip with the money source, the order's patient total and insurer total, and **the delivery's own amount due** beside them (the figure a driver collects), and a link to the order's Insurance section. Without the insurance-view grant the strip shows the money only and no link.

## Spine reach

UI (oms-react)

## Proof (→ `tdd` red-green cycles)

- [ ] `delivery money strip: shows source, patient, insurer and the delivery's amount due` · vitest
- [ ] `delivery money strip: no link without the insurance grant` · vitest

## Boundaries

Read-only.

## Done when

Proof tests green.

## Blocked by

[787](787-document-details-shows-an-insurance-orders-money-verdict-its-lines-how-each-was-priced-and-the-gap-to-engine-money.md)
