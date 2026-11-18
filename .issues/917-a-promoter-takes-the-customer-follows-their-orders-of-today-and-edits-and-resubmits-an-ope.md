---
status: open
spec: BO 4032 (E:\Projects\BackOffice\.issues\4032-mini-pos-promoters-sell-non-pharmacy-items-spec.md)
blocked-by: BO 4039, BO 4040, 916
---

# 917 — A promoter takes the customer, follows their orders of today, and edits and resubmits an open order

## What to build

The rest of the phone flow:
- **The customer step** before the basket: mobile number or Arbahi QR scan; a new mobile goes through sign-up with
  the customer's code; then the member's name or tier is shown.
- **My orders today,** with status.
- **Reopen and resubmit** an open order, showing the server's refusal while a till holds it or after billing.
- **A clear "no connection" state,** with no double submit.

## Spine reach

UI (PWA) → BackOffice SIS.Api (4039, 4040)

## Proof (→ `tdd` red-green cycles)

- [ ] Component: customer required before the basket; refusal while held; no double submit offline · vitest
- [ ] Live walk against a SIS.Api with 4039/4040

## Boundaries

—

## Done when

The full phone flow works end to end against a test pharmacy.

## Blocked by

BO [4039](E:\Projects\BackOffice\.issues\4039-pricing-needs-a-member-a-new-mobile-signs-up-at-the-pharmacy-and-the-customer-gets-the-ord.md), BO [4040](E:\Projects\BackOffice\.issues\4040-a-promoter-edits-and-resubmits-their-open-order-and-the-edit-is-refused-while-a-till-holds.md), [916](916-a-promoter-installs-the-mini-pos-app-signs-in-unlocks-at-the-pharmacy-scans-a-basket-and-s.md)
