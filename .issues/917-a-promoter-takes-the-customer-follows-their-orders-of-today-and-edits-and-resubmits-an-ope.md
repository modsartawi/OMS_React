---
status: open
spec: BO 4063 (E:\Projects\BackOffice\.issues\4063-mini-pos-promoters-sell-non-pharmacy-items-spec.md)
blocked-by: BO 4070, BO 4071, 916
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

UI (PWA) → BackOffice SIS.Api (4070, 4071)

## Proof (→ `tdd` red-green cycles)

- [ ] Component: customer required before the basket; refusal while held; no double submit offline · vitest
- [ ] Live walk against a SIS.Api with 4070/4071

## Boundaries

—

## Done when

The full phone flow works end to end against a test pharmacy.

## Blocked by

BO [4070](E:\Projects\BackOffice\.issues\4070-pricing-needs-a-member-a-new-mobile-signs-up-at-the-pharmacy-and-the-customer-gets-the-ord.md), BO [4071](E:\Projects\BackOffice\.issues\4071-a-promoter-edits-and-resubmits-their-open-order-and-the-edit-is-refused-while-a-till-holds.md), [916](916-a-promoter-installs-the-mini-pos-app-signs-in-unlocks-at-the-pharmacy-scans-a-basket-and-s.md)
