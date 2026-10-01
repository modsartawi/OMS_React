---
status: open
spec: 342
blocked-by: 344
---

# 346 — A supervisor approves or rejects a waiting request beside the entry's figures today

Builds against BackOffice 2191/2192/2194's `## Web contract` (`POST Settlement/ChangeRequest/Approve`,
`/Reject`).

## What to build

An accountant supervisor (`canSuperviseSettlement`) opening an entry with a request waiting sees the card
with **Approve** and **Reject** (W6), plus what the branch has spent from the entry **now** — the History
read's `spentAmount`, not the figure at the time it was raised (story 16).

- **Approve** sends `{ changeRequestId }`. On `requestStatus: "APPLIED"` the pane redraws from the act
  response's `amount` / `remainingAmount` / `spentAmount` / `description` / `entryStatus` **before** the
  refetch lands, then History and the account are re-read (W8). `entryStatus` may move `OPEN` ↔
  `CONSUMED`; a pending entry stays `PENDING_APPROVAL` (approving a change never approves the entry).
- **A refused approve** (`BELOW_SPENT` with today's `spentAmount`, `ENTRY_FINAL`, `CHANGE_STALE`,
  `THEFT_DAY_COLLECTED`, …) leaves the card in place, still `OPEN`, with 344's sentence and next step
  shown on it — the supervisor can then reject with a reason.
- **Reject** opens a Reason box (required, ≤ 200, `ReasonField`) and sends `{ changeRequestId, reason }`.
  The entry is never touched.
- **A bare 403** goes through the existing `supervisionFailure` path: named, the probe re-read, the buttons
  gone (W1). Never decide an outcome from the probe.

## Spine reach

model/api (`approveChangeRequest`, `rejectChangeRequest`) · store/logic · component (card acts, reject
reason) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `afterChangeAct` (or the equivalent pure redraw step) — an approve's act response replaces the pane's
  figures; a refused approve keeps the request `OPEN` with its refusal · pure
- [ ] `settlement-change-drive` extended — supervisor sees Approve/Reject and today's spent; approve
  redraws from the answer before the delayed refetch; a stubbed `BELOW_SPENT` keeps the card with the
  refusal; reject requires a reason; an accountant sees neither button; a bare 403 removes them · flow
  (drive)

## Boundaries

Two new doors behind settlement supervision (W1). The queue tab is 353's.

## Done when

Both Proof items are green, typecheck + `npm test` pass, earlier drives unmodified and green.

## Blocked by

[344](344-every-change-request-refusal-is-said-by-its-code-with-its-next-step.md)
