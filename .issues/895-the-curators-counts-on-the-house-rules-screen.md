---
status: open
spec: BackOffice .issues\3633-the-copilot-keeps-a-readers-own-readings-on-a-tap-spec.md
blocked-by: BackOffice 3691
---

# 895 — The house-rules screen shows how many readers changed each default, and to what

## What to build

BackOffice spec 3633 R30: beside each default reading on the house-rules screen, the count of readers holding their own
and the values shown by the server (only those held by 5 or more).

## Proof (→ `tdd` red-green cycles)

- [ ] The counts draw beside their kind, with nothing for a hidden value · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3691.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3691
