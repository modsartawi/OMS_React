---
status: open
spec: 308
blocked-by: 315
---

# 317 — A Ready for collection screen lists closed uncollected days and prepared receipts

## What to build

A new read-only page under Collections: route, menu leaf, `ScreenGate` on a new access boolean, criteria
(collector, accountant via Served-by, business date) and columns (store, profit center, business day, Z number,
cash to hand over, surplus deducted, days waiting). There is no Z viewer. A collector supervisor lands on the
read screens and reaches no act.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [ ] criteria / columns / projection modules under vitest for the behaviour above
- [ ] the screen renders against the contract stub (loading, empty, error, refusal)

## Blocked by

- BackOffice [1994](C:\Work\DMSCO\BackOffice-spec1976\.issues\1994-a-ready-for-collection-screen-lists-what-waits-for-a-collector.md) must be **done** and its `## Web contract` written
- BackOffice [1995](C:\Work\DMSCO\BackOffice-spec1976\.issues\1995-a-collector-supervisor-sees-every-collectors-work-read-only.md) must be **done** and its `## Web contract` written
- [315](315-collections-takes-the-four-filters-and-shows-both-dates.md)
