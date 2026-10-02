---
status: done
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

- [x] `supersedeWarning` — drawn with an open request (History) or a non-empty `openChangeRequestId`
  (row); not drawn otherwise; always for a batch · pure — `change-request.test.ts` (History answered /
  in flight / failed / 404, row set / `''` / absent, batch), plus `supersededRequest` and `closedBy`
- [x] `settlement-change-drive` extended — Cancel / Write off / Approve / Reject confirm steps carry the
  sentence only when a request waits; after an accepted Cancel the stubbed History re-read shows the card
  superseded; the batch withdraw carries the sentence · flow (drive) — sections 35–39, 337/337 (stubbed,
  never live); also an accepted Approve → superseded, a refused Cancel → card still OPEN, the lane reading
  no History. Earlier drives unmodified and green: settlement 291, approval 42, description 41,
  supervision 41, theft 62. vitest 3133/3133; typecheck, lint, build green.

## Boundaries

No new door; the direct doors' shapes are unchanged. Existing settlement drives must stay green unmodified
(the sentence is absent when nothing waits).

## Done when

Both Proof items are green, typecheck + `npm test` pass, earlier drives unmodified and green.

## Blocked by

[343](343-an-accountant-asks-to-change-an-untouched-entry-and-the-pane-shows-it-waiting.md),
[351](351-ledger-and-open-settlement-rows-mark-an-entry-with-a-change-waiting.md)

## Comments

- **Done 2026-10-02.** Pure `supersedeWarning` / `supersededRequest` / `closedBy` in `change-request.ts`
  (W12 section, beside — not inside — `offerFor`); one `SupersedeNote` in the correction confirm step,
  the approval dialog (entry panel from the ONE History query, lane from the row's CURRENT
  `openChangeRequestId`) and Bulk Cancel; the pane draws the superseded request from History.
- 🚩 Owner sign-off wanted (`.afk/HITL-352.md`): (1) an `unknown` sentence while History is in flight or
  failed (not 404) — the ticket said "not drawn otherwise"; (2) the batch copy narrowed to *"…waiting on an
  entry this withdraws…"* (2194: a refused row keeps its request OPEN) instead of the ticket's verbatim
  words; (3) the superseded card persists while it is the entry's latest request.
- Bulk Cancel now re-reads every History read (the batch's entries are not known on the web).
- Reviews: `/code-review` (9 findings, 7 acted on), `/standards-review` MINOR (`.afk/REVIEW-352.md`).
