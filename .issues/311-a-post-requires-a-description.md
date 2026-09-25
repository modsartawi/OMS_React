---
status: open
spec: 308
blocked-by: —
---

# 311 — Posting an entry requires a description

## What to build

`ReasonField` is required (non-blank after trim, <= 200) on the single post, and the bulk template's
description column is marked required. A server refusal for a blank row is shown against that row.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [ ] criteria / columns / projection modules under vitest for the behaviour above
- [ ] the screen renders against the contract stub (loading, empty, error, refusal)

## Blocked by

- BackOffice [1980](C:\Work\DMSCO\BackOffice-spec1976\.issues\1980-an-entry-cannot-be-posted-without-a-description.md) must be **done** and its `## Web contract` written
