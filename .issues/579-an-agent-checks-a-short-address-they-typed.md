---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3072-the-location-link-confirms-the-short-address-with-spl-spec.md
blocked-by: — (live: BackOffice 3074)
---

# 579 — An agent checks a Short Address they typed on the web seat

## What to build

The web seat's half of BackOffice [3078](C:\Work\DMSCO\BackOffice\.issues\3078-a-cc-v1-agent-checks-a-short-address-they-typed.md).

- A **Check** button beside the Short Address field in the call-centre address form (`AddressForm`).
- It calls `GET NationalAddress/ShortAddress/{code}?language=A|E` (BackOffice 3074) in the console's
  language and shows the answer inline:
  - `FOUND`: the parts on one line, plus the additional number, and the city warning when SPL's city is
    not the form's;
  - `UNKNOWN`: **Not known to SPL**;
  - `UNAVAILABLE` or any failure: **SPL is unavailable, not checked**.
- A malformed code (`CCL-00014`) is shown as the field's own error.
- It never blocks saving. Hidden while the session's capabilities say SPL is not configured (the
  capability's name comes with BackOffice 3074; record it in the contract asset).

## Spine reach

UI → app → SIS.Api → SPL.

## Proof

- [ ] component tests for each outcome and the hidden state, against stubs
- [ ] a run against a dev SIS.Api with the owner's key

## Boundaries

Read only: nothing from SPL's answer is saved by this ticket.

## Done when

The Proof is green.

## Blocked by

None against stubs; live: BackOffice 3074.
