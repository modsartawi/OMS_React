---
status: open
spec: 308
blocked-by: 315
---

# 316 — ACRs, Deposits and Attempts take the same four filters

## What to build

Copy 315's shape onto `acr-criteria`, `deposit-criteria` and `attempts-criteria` with the per-screen meanings
of BackOffice spec 1976. Attempts gains the Served-by picker. The ACR number and deposit number boxes now reach
real server parameters. Business date and collection date become default columns where they apply.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [ ] criteria / columns / projection modules under vitest for the behaviour above
- [ ] the screen renders against the contract stub (loading, empty, error, refusal)

## Blocked by

- BackOffice [1993](C:\Work\DMSCO\BackOffice-spec1976\.issues\1993-acrs-deposits-and-attempts-take-the-same-four-filters.md) must be **done** and its `## Web contract` written
- [315](315-collections-takes-the-four-filters-and-shows-both-dates.md)
