---
status: open
spec: 342
blocked-by: 343, 351
---

# 352 — A direct Cancel, Write off, Approve, Reject or Bulk Cancel warns that a waiting request will be superseded

Builds against BackOffice 2194's `## Web contract` ("The direct doors").

## What to build

The direct supervisor acts are unchanged on the web (W12): `Settlement/Cancel`, `/CloseOut` (Write off),
`/Approve`, `/Reject` of a pending entry, and `Settlement/Bulk/Cancel`. Their confirm steps gain one
sentence: *"the waiting change request will be closed as superseded."*

- **Entry panel acts** (correction pane, approval pane/dialog): the sentence is drawn when the History
  read (343) has an `openRequest`. After an accepted act, History is re-read and the card shows the request
  **superseded** (then 350's audit carries it).
- **Lane approve/reject** (Awaiting approval): the sentence is drawn when the row's `openChangeRequestId`
  (351) is not `''`.
- **Bulk Cancel:** nothing on the web enumerates a batch's entries (`BatchWithdraw.tsx`), so the sentence
  is **unconditional** there: *"any change request waiting on these entries will be closed as
  superseded."*
- A refused act leaves the request `OPEN` and says nothing new.

## Spine reach

store/logic (pure `supersedeWarning` from History/row) · component (four confirm steps + batch) · i18n ·
test

## Proof (→ `tdd` red-green cycles)

- [ ] `supersedeWarning` — drawn with an open request (History) or a non-empty `openChangeRequestId`
  (row); not drawn otherwise; always for a batch · pure
- [ ] `settlement-change-drive` extended — Cancel / Write off / Approve / Reject confirm steps carry the
  sentence only when a request waits; after an accepted Cancel the stubbed History re-read shows the card
  superseded; the batch withdraw carries the sentence · flow (drive)

## Boundaries

No new door; the direct doors' shapes are unchanged. Existing settlement drives must stay green unmodified
(the sentence is absent when nothing waits).

## Done when

Both Proof items are green, typecheck + `npm test` pass, earlier drives unmodified and green.

## Blocked by

[343](343-an-accountant-asks-to-change-an-untouched-entry-and-the-pane-shows-it-waiting.md),
[351](351-ledger-and-open-settlement-rows-mark-an-entry-with-a-change-waiting.md)
