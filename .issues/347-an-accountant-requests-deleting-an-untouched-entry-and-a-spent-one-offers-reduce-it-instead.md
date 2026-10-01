---
status: done
spec: 342
blocked-by: 344
---

# 347 — An accountant requests deleting an untouched entry; a spent one offers "Reduce it to X" instead

Builds against BackOffice 2193's `## Web contract`.

## What to build

On an entry nobody has spent from, the pane offers **Request delete** beside Request a change (W3). The
delete form asks for a **Reason** only and sends `{ settlementEntryId, requestKind: "DELETE", reason }`
— no `newAmount`, `newDescription` or `newBusinessDay` (W5). An accepted delete draws the waiting card
with kind *delete*.

On an entry the branch **has** spent from (History's `spentAmount` > 0 at holding scale), there is no
delete: the pane says *"The branch has spent X from this entry, so it cannot be deleted"* and offers
**Reduce it to X**, which opens 343's change form with `X` filled in as the new amount. The same happens
when the server answers `DELETE_SPENT`, using that answer's `spentAmount` (344's next step).

A delete **cancels the entry** once approved (`entryStatus: "CANCELLED"`, `spentAmount: 0`) — 346's
redraw already shows that; this ticket checks it. A request is never said to be "cancelled" (W13).

## Spine reach

model/api (Raise body gains `DELETE`) · store/logic (`deleteRequestBody`, offer cell) · component (delete
form, reduce offer) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `deleteRequestBody` — sends `requestKind: "DELETE"` and a trimmed reason, no figure fields at all ·
  pure
- [x] `reduceToSpent` — from the History read or a `DELETE_SPENT` answer, yields the change draft with
  `newAmount = spentAmount` (a BHD `0.001` spent included) · pure
- [x] `settlement-change-drive` extended — untouched entry offers Request delete and posts no figures;
  spent entry shows the sentence and Reduce it to X pre-fills the change form; a stubbed `DELETE_SPENT`
  does the same; an approved delete redraws the entry as cancelled · flow (drive)

## Boundaries

No new door (delete rides Raise). `SettlementDeleteTakesNoFigures` is already 344's field error.

## Done when

The three Proof items are green, typecheck + `npm test` pass, earlier drives unmodified and green.

## Blocked by

[344](344-every-change-request-refusal-is-said-by-its-code-with-its-next-step.md)

## Proof record (2026-10-01)

- `change-request.test.ts`: `deleteRequestBody` (exact three keys, trimmed Reason, held blank/over 200),
  `reduceToSpent` (from `offerFor`'s cell and from 344's `DELETE_SPENT` step, BHD `0.001` included), the
  approved-delete redraw to `CANCELLED`, and `removeSaidBy` (the spent sentence said once, never stale).
- `tools/settlement-change-drive.mjs` §24–27: 219/219 against stubs of 2193's contract (no live SIS.Api).
  Earlier settlement drives unmodified and green. typecheck, `npm test` (3050), lint, build all pass.
- Decisions: `.afk/HITL-347.md`; reviews: `.afk/REVIEW-347.md`.
