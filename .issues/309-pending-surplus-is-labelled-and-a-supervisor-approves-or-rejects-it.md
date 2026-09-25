---
status: done
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

- [x] criteria / columns / projection modules under vitest for the behaviour above — `approval.test.ts` (38 cases over `approval-fixture.ts`: headline/grid/remaining/correction/audit/ledger/open-lane/queue/bulk) + `access.test.ts` (the supervision predicate); mutation-checked (headline as an exclusion list → 5 red; open-lane without its OPEN filter → 1 red)
- [x] the screen renders against the contract stub (loading, empty, error, refusal) — `tools/settlement-approval-drive.mjs` 42/42 against stubs shaped as 1977/1978's Web contract (plus a bare 403); `settlement-drive.mjs` 291/291 and `collection-drive.mjs` 220/220 still green

## Blocked by

- BackOffice [1977](C:\Work\DMSCO\BackOffice-spec1976\.issues\1977-a-large-surplus-waits-for-a-supervisor-and-no-till-sees-it.md) must be **done** and its `## Web contract` written
- BackOffice [1978](C:\Work\DMSCO\BackOffice-spec1976\.issues\1978-a-supervisor-rejects-a-pending-surplus-and-bulk-rows-land-pending.md) must be **done** and its `## Web contract` written

## Comments

**Done 2026-09-25 (AFK).** Contracts BackOffice 1977 + 1978 (both done, both with `## Web contract`) cross-checked
against the committed SIS.Api / Data source on BackOffice main — **no difference found**.

- **Wire:** `SettlementEntryStatus` gains `PENDING_APPROVAL` / `REJECTED`; entries carry the five approval fields;
  `SettlementPostResult.status`; `SettlementSupervisionResult` (Approve/Reject); `SettlementBulkRow.awaitsApproval`;
  `CollectionAccessResult.canSuperviseSettlement` (required, read `=== true` by `canSuperviseSettlement`).
- **Totals:** every figure is OPEN-only — the account headline (plus a separate *count* of pending, never a sum),
  the open lane's tallies (filtered on the row's own status), the remaining column (`remainingIsAClaim`). The
  signed position is still displayed, never consumed.
- **Labelled:** *Awaiting approval* / *Rejected* on the account and ledger grids (pending not dimmed); ledger
  status chips for both; the correction panel offers nothing on either; the journal and audit pane say why.
- **Queue:** Open settlements ▸ *Awaiting approval* — `Settlement/Ledger?status=PENDING_APPROVAL&sort=age`, its
  own count/cap/failure. Approve / Reject on a pending row only, only with `canSuperviseSettlement`, from the
  queue and from the entry's panel on its account, through one `ApprovalDialog` (amount, branch, poster,
  description; Reject needs a reason). `ENTRY_NOT_PENDING` reads as *"it is now X — nothing was changed"*; a bare
  403 is named and re-reads the probe.
- **Rejected:** the accountant sees who, when and the supervisor's reason (panel + audit).
- **Bulk:** the preview marks `awaitsApproval` rows and counts them; waiting blocks nothing.
- Small contract-named extras: the post confirmation says a pending surplus waits; a batch withdrawal groups its
  pending rows apart from "a till got to these first".

Decisions and review outcomes: `.afk/HITL-309.md`. Gates: typecheck, lint (3 gates), vitest 135 files / 2268 tests,
build — all green.

**Outstanding (not AFK's):** a drive against a LIVE SIS.Api carrying 1977/1978 (every drive here is stubbed); the
correction-action hiding for non-supervisors is 310.
