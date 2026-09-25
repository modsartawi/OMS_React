---
status: done
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

- [x] criteria / columns / projection modules under vitest for the behaviour above — `correction.test.ts`
  (`correctionShownTo`: a supervisor keeps the one button, an accountant gets `supervisor-only` carrying the same
  offer and never a button kind, a none-entry reads the same to both, a race recovery shown after the grant went is
  still no button) + `bulk.test.ts` (`withdrawalGroups`: 1979's three rows plus a rejected one, each in exactly one
  group). The 403 recogniser is 309's `supervisionFailure` (already pinned). vitest **2275** green.
- [x] the screen renders against the contract stub (loading, empty, error, refusal) —
  `tools/settlement-supervision-drive.mjs` **41/41** against 1979's envelopes stubbed verbatim: accountant sees the
  panel with no button on untouched + partly-used entries; supervisor cancels / writes off (bodies are the
  contract's two fields); refusals `REMAINING_INSUFFICIENT` (recovers into the write-off) and `ENTRY_NOT_OPEN`;
  errors: bare 403 (named, probe re-read, button gone) and 400 `SettlementReasonTooLong` (server sentence, box kept);
  batch withdrawal for accountant (no box/button) and supervisor (loading "Withdrawing…", the three rows in their
  groups, 403); bulk confirmation's link for a supervisor only; account loading + empty. Regression:
  `settlement-drive` **291/291** (its session now supervises), `settlement-approval-drive` **42/42**.
  Typecheck, lint (3 gates) and build clean.
- Outstanding (not AFK's): any drive against a LIVE SIS.Api with 1979 — every check above is stubbed.

## Blocked by

- BackOffice [1979](C:\Work\DMSCO\BackOffice-spec1976\.issues\1979-only-a-supervisor-cancels-closes-out-or-withdraws-a-batch.md) must be **done** and its `## Web contract` written
- [309](309-pending-surplus-is-labelled-and-a-supervisor-approves-or-rejects-it.md)

## Comments

**Done 2026-09-25 (AFK).** Built against BackOffice 1979's `## Web contract`, cross-checked with the committed
SIS.Api (`Supervised(...)` on `Settlement/Cancel`, `Settlement/CloseOut`, `Settlement/Bulk/Cancel`), and found no
drift. There is no new field: the flag is 309's `canSuperviseSettlement`.

- **Correction panel:** a supervisor keeps the one button. An accountant sees the act the entry would take, named as
  an accountant supervisor's, with no button and no reason box (`correctionShownTo` in `correction.ts`).
- **Batch withdrawal (`/upload?batch=`):** an accountant sees the batch and who withdraws it, with no box and no
  button. The outcome groups rows through the pure `withdrawalGroups`. A row a supervisor already rejected gets its
  own group with no remaining (found by `/code-review`).
- **Bulk confirmation:** the withdrawal link is shown to a supervisor only. An accountant is handed the withdrawal
  address as text to pass on.
- **403:** on any of the three doors, it is named in an en key and re-reads the probe, so the act disappears.
- **Copy:** the no-amend line and the three "immutable" lines now name the accountant supervisor.

Decisions and review outcomes are in `.afk/HITL-310.md`.
