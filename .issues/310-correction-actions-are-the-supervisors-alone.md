---
status: open
spec: 308
blocked-by: 309
---

# 310 — Cancel, close-out and batch withdrawal are shown only to a supervisor

## What to build

`EntryCorrection`, `BatchWithdraw` and any other entry point to cancel / close-out / withdraw render only for a
session with the settlement supervision access boolean. An accountant sees the entry without them. The screen
copy that explains corrections names the supervisor.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [ ] criteria / columns / projection modules under vitest for the behaviour above
- [ ] the screen renders against the contract stub (loading, empty, error, refusal)

## Blocked by

- BackOffice [1979](C:\Work\DMSCO\BackOffice-spec1976\.issues\1979-only-a-supervisor-cancels-closes-out-or-withdraws-a-batch.md) must be **done** and its `## Web contract` written
- [309](309-pending-surplus-is-labelled-and-a-supervisor-approves-or-rejects-it.md)
