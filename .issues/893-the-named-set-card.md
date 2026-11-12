---
status: open
spec: BackOffice .issues\3633-the-copilot-keeps-a-readers-own-readings-on-a-tap-spec.md
blocked-by: BackOffice 3687, 892
---

# 893 — The named-set card shows the name and its members, with Keep and Not now

## What to build

BackOffice spec 3633 R20: the card for a proposed named set: the name, each member with its kind, Keep and Not now,
and the refusal reason when the reader is at the limit.

## Proof (→ `tdd` red-green cycles)

- [ ] The card shows the name and members and sends Keep · oms-react tests
- [ ] A refusal at the limit is shown with a link to the page · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3687.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3687, 892
