---
status: open
spec: 308
blocked-by: —
---

# 315 — Collections filters by collector, accountant, business date and collection date, and shows both dates

## What to build

`collections-criteria` sends business date from/to and collection date from/to beside collector and served-by.
Business date and collection date become default columns. This sets the criteria shape 316 copies.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [ ] criteria / columns / projection modules under vitest for the behaviour above
- [ ] the screen renders against the contract stub (loading, empty, error, refusal)

## Blocked by

- BackOffice [1992](C:\Work\DMSCO\BackOffice-spec1976\.issues\1992-collections-filters-by-collector-accountant-business-and-collection-date.md) must be **done** and its `## Web contract` written
