---
status: open
spec: 308
blocked-by: —
---

# 314 — The ACR form, voucher and grids show the profit center beside the store code

## What to build

Render the profit center as the server formats it (`PH-019 (P019)`, or the store code alone) on the ACR form
rows, the voucher's store line, and a profit center column in the Collections, ACRs and Attempts grids (CSV
included).

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [ ] criteria / columns / projection modules under vitest for the behaviour above
- [ ] the screen renders against the contract stub (loading, empty, error, refusal)

## Blocked by

- BackOffice [1990](C:\Work\DMSCO\BackOffice-spec1976\.issues\1990-hq-papers-and-web-grids-show-the-profit-center.md) must be **done** and its `## Web contract` written
