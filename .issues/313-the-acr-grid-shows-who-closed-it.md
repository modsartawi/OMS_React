---
status: open
spec: 308
blocked-by: —
---

# 313 — The ACR grid shows who closed each ACR, including SYSTEM

## What to build

A closed-by column on the ACRs grid and the ACR form header. `SYSTEM` reads as "Closed automatically at end
of day" (EN+AR), and a collector id as that collector's name.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [ ] criteria / columns / projection modules under vitest for the behaviour above
- [ ] the screen renders against the contract stub (loading, empty, error, refusal)

## Blocked by

- BackOffice [1987](C:\Work\DMSCO\BackOffice-spec1976\.issues\1987-every-open-acr-is-closed-at-2359-by-the-system.md) must be **done** and its `## Web contract` written
