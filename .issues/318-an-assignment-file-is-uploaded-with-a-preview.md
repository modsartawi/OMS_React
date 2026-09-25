---
status: open
spec: 308
blocked-by: —
---

# 318 — An assignment file is uploaded with a preview, then committed

## What to build

An upload view on `CollectionAssignmentPage`: pick xlsx/csv, show the preview (changes per store, refused
rows named), commit once (idempotent re-press), and download a template (StoreCode, AccountantId, CollectorId;
a blank cell means unchanged). Follow the settlement bulk upload's shape.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [ ] criteria / columns / projection modules under vitest for the behaviour above
- [ ] the screen renders against the contract stub (loading, empty, error, refusal)

## Blocked by

- BackOffice [1996](C:\Work\DMSCO\BackOffice-spec1976\.issues\1996-an-assignment-file-is-previewed-and-committed-as-one-act.md) must be **done** and its `## Web contract` written
