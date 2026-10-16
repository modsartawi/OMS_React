---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516, 517, 518, 519
---

# 520 — The rule-campaign screens call the real doors on staging

## What to build

Once BackOffice 2758 has written its **contract section into the brief** and the doors are deployed to staging,
re-point every provisional api in `core/rules/` and the campaigns / engine-switch features at the real paths and
shapes. Drop the `PROVISIONAL` marks. Add the Ua **access probes** (author / approver for the group, the
engine-switch and session-cancel permissions) and adapt the stubs to the real envelopes. Then run the
drives live and do an **owner walk**: build one of the five real campaigns, simulate it, ask for approval, activate as an
approver, and flip a pilot store.

## Spine reach

model/api (re-point) · component (probes) · test (live drives)

## Proof (→ `tdd` red-green cycles)

- [ ] every campaigns drive green against staging · flow
- [ ] owner walk recorded in this ticket · manual

## Boundaries

Live: BackOffice 2744, 2745, 2754, 2755, 2758, 2759, 2760 deployed, plus their Ua permission seeds and owner grants.

## Done when

The drives pass against staging and the owner walk is recorded.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md) through
[519](519-support-finds-a-coupon-code-and-reads-a-members-wallet-balance-and-budgets-used.md)
