---
status: done
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

- [x] `afterChangeAct` (or the equivalent pure redraw step) — an approve's act response replaces the pane's
  figures; a refused approve keeps the request `OPEN` with its refusal · pure
- [x] `settlement-change-drive` extended — supervisor sees Approve/Reject and today's spent; approve
  redraws from the answer before the delayed refetch; a stubbed `BELOW_SPENT` keeps the card with the
  refusal; reject requires a reason; an accountant sees neither button; a bare 403 removes them · flow
  (drive)

## Boundaries

Two new doors behind settlement supervision (W1). The queue tab is 353's.

## Done when

Both Proof items are green, typecheck + `npm test` pass, earlier drives unmodified and green.

## Blocked by

[344](344-every-change-request-refusal-is-said-by-its-code-with-its-next-step.md)

## Done — 2026-10-01

- **Pure** (`npm test`, 3,033 green): `afterDecide` (decided / unconfirmed / refused, read from the answer's
  `requestStatus` and never from the probe); `paneRead`, the W8 redraw step, which is the ticket's
  `afterChangeAct`. In `paneRead` an approve's answer replaces the figures and drops the card, `CONSUMED`,
  `PENDING_APPROVAL` and `CANCELLED` come from the answer, a refused approve keeps History's `OPEN` request
  with today's spent figure, and an answer about another entry is ignored. `rejectBody` sends a required,
  trimmed Reason of at most 200. In 344's map, `ENTRY_NOT_OPEN` at approval that names the entry is now
  `reread`, not `close`.
- **Drive** `tools/settlement-change-drive.mjs` §19–23, **171/171** against STUBBED envelopes (no live
  SIS.Api with the 2190 wave). The earlier drives are unmodified and green: settlement 291/291, approval
  42/42, supervision 41/41, theft 62/62, description 41/41.
- `typecheck`, `lint` and `build` are green. `/code-review` found three things, now fixed: the Reject draft
  is now per request, opening Reject keeps the refusal on screen, and the body that was checked is the body
  sent. `/standards-review` found no hard violations. The spec axis found `ENTRY_NOT_OPEN` at approval
  (fixed, W7 row amended). It also flagged `ENTRY_FINAL` at approval, which is kept as HITL-343 rules and
  waits on an owner ruling. Decisions are in `.afk/HITL-346.md`, reviews in `.afk/REVIEW-346.md`.
