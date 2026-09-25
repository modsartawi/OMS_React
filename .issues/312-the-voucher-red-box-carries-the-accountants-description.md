---
status: open
spec: 308
blocked-by: —
---

# 312 — The collection voucher's red box carries the accountant's description

## What to build

`CollectionVoucher` renders the description inside `.cv-overage-box` on the surplus day page and the
settlement page, beside the amount and entry number, wrapping up to 200 characters. A page without a
description prints the entry number alone. Ordinary days keep the empty box.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [ ] criteria / columns / projection modules under vitest for the behaviour above
- [ ] the screen renders against the contract stub (loading, empty, error, refusal)

## Blocked by

- BackOffice [1984](C:\Work\DMSCO\BackOffice-spec1976\.issues\1984-the-shortage-settlement-receipt-and-web-voucher-carry-the-description.md) must be **done** and its `## Web contract` written
