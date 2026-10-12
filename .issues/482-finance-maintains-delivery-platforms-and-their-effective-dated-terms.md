---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2615-deliverect-delivery-platforms-spec.md
blocked-by: 477 (live: BackOffice 2627)
---

# 482 — Finance maintains delivery platforms and their effective-dated terms

## What to build

- **Feature** `features/deliverect/terms`, at the route `/deliverect/terms`, with the namespace
  `deliverect-terms`.
- **Accounts**: a read-only list.
- **Platforms**: display name, Deliverect channel id, credit customer and active.
  - Edit with a reason.
  - A platform cannot be active without a credit customer. The UI says why: its orders would be
    refused.
- **Terms**: a timeline per platform, showing valid from/to, customer discount %, commission %,
  delivery fee and threshold (3 decimal places, `currencyKey`).
  - **Add terms** creates a new row from a date. The dialog says the previous row closes the day
    before.
  - Rows are never edited; a correction is a new row.
  - DLV-00008 (overlap) shows inline.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\2615-deliverect-web-door-contract.md` (Platforms and terms).

## Spine reach

UI → app (BackOffice doors, stubbed until 483)

## Proof (→ `tdd` red-green cycles)

- [ ] `termsTimeline`: rows sort by `validFrom`, the open row is marked current, and a proposed `validFrom` inside an existing row is flagged (vitest)
- [ ] `tools/deliverect-terms-drive.mjs`, against stubs: edit a platform, add terms, the overlap refusal, hidden without `canManageTerms`
- [ ] typecheck, lint, test green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real boundary. The BackOffice doors are built in parallel; until they are deployed, prove the page against stubs of the contract (real envelope `errors[]` shape, fixtures emitting **exactly** the contract's fields).

## Done when

The helpers and the drive are green.

## Blocked by

- [477](477-an-hq-user-onboards-a-store-on-a-deliverect-account-and-sees-its-link.md)

(live: BackOffice 2627)
