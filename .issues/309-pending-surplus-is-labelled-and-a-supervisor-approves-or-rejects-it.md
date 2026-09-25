---
status: open
spec: 308
blocked-by: —
---

# 309 — A pending surplus is labelled, excluded from totals, and a supervisor approves or rejects it

## What to build

In the settlement screens (spec 267 family): an entry in `PENDING_APPROVAL` or `REJECTED` is labelled in
the ledger, branch account and open lane, and is **excluded from every headline total**. The open lane can
filter to pending. A session holding the new **settlement supervision** access boolean sees **Approve** and
**Reject** (with a required reason) on a pending row. The accountant sees a rejected entry with the
supervisor's reason. The bulk upload preview marks the rows that will wait for approval (SURPLUS >= 500).

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [ ] criteria / columns / projection modules under vitest for the behaviour above
- [ ] the screen renders against the contract stub (loading, empty, error, refusal)

## Blocked by

- BackOffice [1977](C:\Work\DMSCO\BackOffice-spec1976\.issues\1977-a-large-surplus-waits-for-a-supervisor-and-no-till-sees-it.md) must be **done** and its `## Web contract` written
- BackOffice [1978](C:\Work\DMSCO\BackOffice-spec1976\.issues\1978-a-supervisor-rejects-a-pending-surplus-and-bulk-rows-land-pending.md) must be **done** and its `## Web contract` written
