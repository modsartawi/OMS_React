---
status: open
spec: BackOffice .issues\3633-the-copilot-keeps-a-readers-own-readings-on-a-tap-spec.md
blocked-by: BackOffice 3689
---

# 894 — The page "What the copilot knows about me" lists, changes and deletes every kept reading and named set

## What to build

BackOffice spec 3633 R25, R28, R29: the page, reachable from the panel: each kept reading with its value (change, delete),
each named set with its members (edit through the name lookup, delete), unused readings and vanished members marked,
and "Forget everything" with a confirm. Built so the investigations spec's profile can join it.

## Proof (→ `tdd` red-green cycles)

- [ ] The page lists readings and sets, marking unused ones · oms-react tests
- [ ] Change, edit, delete and forget everything call their doors and redraw · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3689.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3689
